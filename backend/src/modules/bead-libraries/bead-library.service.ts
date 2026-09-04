import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { settingsService } from "../settings/settings.service.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { cropConfigSemanticallyEqual } from "../../lib/save-payload-equal.js";
import { runBackgroundTask } from "../../lib/run-background-task.js";
import {
  isBeadCropConfigValid,
  refreshBeadCropStoredMetrics,
  type BeadCropConfig,
} from "@bino-foundry/shared/types";
import { beadAvailabilityStatusService } from "../bead-availability-statuses/bead-availability-status.service.js";
import { beadLibrarySizeService } from "../bead-library-sizes/bead-library-size.service.js";
import { tagService } from "../tags/tag.service.js";
import { mmGroupNormalizationService } from "../bead-sizes/mm-group-normalization.service.js";
import {
  collectBeadLibraryAssetUrls,
  deleteBeadLibraryAssetUrls,
} from "./bead-library-assets.js";
import type {
  BeadLibraryCreateDTO,
  BeadLibraryCropDTO,
  BeadLibraryUpdateDTO,
} from "./bead-library.validation.js";
import type { SyncLibrarySizesDTO } from "../bead-library-sizes/bead-library-size.validation.js";

type Specs = Record<string, unknown>;

function mergeSpecs(existing: unknown, patch: Specs): Specs {
  const base =
    existing !== null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Specs) }
      : {};
  return { ...base, ...patch };
}

function processedUrlFromCropConfig(cropConfig: unknown): string {
  if (!cropConfig || typeof cropConfig !== "object") return "";
  const url = (cropConfig as { processedUrl?: string }).processedUrl;
  return typeof url === "string" ? url.trim() : "";
}

function mapBeadLibraryRow(
  row: Record<string, unknown>,
  tags: { id: string; name: string; slug: string }[] = [],
): Record<string, unknown> {
  const beadType = row.bead_types as Record<string, unknown> | null | undefined;
  const subBeadType = row.sub_bead_types as Record<string, unknown> | null | undefined;
  const original = String(row.original_image_url ?? "").trim();
  let processed = String(row.processed_image_url ?? "").trim();
  if (processed && original && processed === original) {
    processed = "";
  }
  if (!processed) {
    processed = processedUrlFromCropConfig(row.crop_config);
    if (processed && original && processed === original) processed = "";
  }
  const displayImage = processed || original;

  return {
    id: row.public_id,
    name: row.name,
    image: displayImage,
    originalImage: original,
    processedImage: processed,
    beadTypeId: row.bead_type_id,
    beadTypeSlug: beadType?.slug ?? undefined,
    subBeadTypeId: row.sub_bead_type_id,
    subBeadTypeSlug: subBeadType?.slug ?? undefined,
    subBeadTypeName: subBeadType?.name ?? undefined,
    description: row.description ?? "",
    metadata: row.metadata ?? {},
    cropConfig: row.crop_config ?? null,
    cropStatus: row.crop_status ?? "draft",
    isActive: row.is_active !== false,
    availabilityStatusCode: String(row.availability_status_code ?? "ACTIVE"),
    displayOrder: Number(row.display_order ?? 0),
    tags,
    tagSlugs: tags.map((t) => t.slug),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BeadLibraryService {
  async list(options?: { forBuilder?: boolean }): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    // Omit crop_config from list — polygon payloads are huge; admin edit loads GET by id.
    const { data, error } = await supabase
      .from("bead_libraries")
      .select(
        "id,public_id,name,original_image_url,processed_image_url,bead_type_id,sub_bead_type_id,description,metadata,crop_status,is_active,availability_status_code,display_order,created_at,updated_at,bead_types(slug, name, is_active),sub_bead_types(slug, name, bead_type_id, is_active)",
      )
      .order("display_order", { ascending: true })
      .order("public_id", { ascending: true });

    assertNoDbError(error);
    let rows = (data ?? []) as Record<string, unknown>[];

    if (options?.forBuilder) {
      const statuses = await beadAvailabilityStatusService.list();
      const showInBuilderByCode = new Map(
        statuses.map((status) => [status.code, status.showInBuilder === true]),
      );

      rows = rows.filter((row) => {
        if (row.is_active === false) return false;

        const beadType = row.bead_types as { is_active?: boolean } | null | undefined;
        if (beadType?.is_active === false) return false;

        const subBeadType = row.sub_bead_types as { is_active?: boolean } | null | undefined;
        if (row.sub_bead_type_id && subBeadType?.is_active === false) return false;

        const code = String(row.availability_status_code ?? "ACTIVE");
        const showInBuilder = showInBuilderByCode.get(code);
        if (showInBuilder !== undefined) return showInBuilder;
        return true;
      });
    }

    const internalIds = rows.map((row) => String(row.id));
    const tagsByLibraryId = await tagService.tagsByBeadLibraryIds(internalIds);

    return rows.map((row) => {
      const tags = tagsByLibraryId.get(String(row.id)) ?? [];
      return mapBeadLibraryRow(row, tags);
    });
  }

  async getByClientId(clientId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_libraries")
      .select("*, bead_types(slug, name), sub_bead_types(slug, name, bead_type_id)")
      .eq("public_id", clientId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead not found");
    const row = data as Record<string, unknown>;
    const tags = (await tagService.tagsByBeadLibraryIds([String(row.id)])).get(String(row.id)) ?? [];
    return mapBeadLibraryRow(row, tags);
  }

  async create(payload: BeadLibraryCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { currencyCode } = await settingsService.getGeneralSettings();

    const original =
      payload.originalImage?.trim() ||
      payload.image?.trim() ||
      "";
    const processed = payload.processedImage?.trim() || "";
    let cropStatus = payload.cropStatus ?? (processed ? "ready" : "draft");
    if (payload.cropConfig) {
      if (!isBeadCropConfigValid(payload.cropConfig)) {
        throw new ValidationError("cropConfig must include a valid crop path or region");
      }
      cropStatus = payload.cropStatus ?? "ready";
    }

    const availabilityStatusCode =
      payload.availabilityStatusCode ?? (payload.isActive === false ? "INACTIVE" : "ACTIVE");
    await beadAvailabilityStatusService.getByCode(availabilityStatusCode);

    const { data: subType, error: subErr } = await supabase
      .from("sub_bead_types")
      .select("bead_type_id")
      .eq("id", payload.subBeadTypeId)
      .maybeSingle();
    assertNoDbError(subErr);
    if (!subType) {
      throw new ValidationError("subBeadTypeId not found");
    }
    if (String((subType as { bead_type_id: string }).bead_type_id) !== payload.beadTypeId) {
      throw new ValidationError("subBeadTypeId must belong to the selected bead type");
    }

    const insertRow = {
      public_id: payload.id.trim(),
      name: payload.name.trim(),
      currency_code: currencyCode,
      description: payload.description?.trim() ?? "",
      bead_type_id: payload.beadTypeId,
      sub_bead_type_id: payload.subBeadTypeId,
      original_image_url: original,
      processed_image_url: processed,
      crop_config: payload.cropConfig ?? null,
      crop_status: cropStatus,
      metadata: payload.metadata ?? {},
      specs: original ? { legacy_image_url: original } : {},
      display_order: payload.displayOrder ?? 0,
      availability_status_code: availabilityStatusCode,
      is_active: payload.isActive ?? true,
    };

    const { data, error } = await supabase.from("bead_libraries").insert(insertRow).select("*, bead_types(slug, name), sub_bead_types(slug, name, bead_type_id)").single();

    if (error?.code === "23505") {
      throw new ConflictError("Bead id already exists");
    }
    assertNoDbError(error);

    const createdRow = data as Record<string, unknown>;
    const tags = await tagService.syncBeadLibraryTags(String(createdRow.id), payload.tags);

    await beadLibrarySizeService.syncLibrarySizes(payload.id.trim(), {
      sizes: payload.sizes,
    });

    return mapBeadLibraryRow(createdRow, tags);
  }

  async update(clientId: string, payload: BeadLibraryUpdateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase
      .from("bead_libraries")
      .select("*")
      .eq("public_id", clientId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Bead not found");

    const row = existing as Record<string, unknown>;
    let specs = mergeSpecs(row.specs, {});

    if (payload.subBeadTypeId !== undefined) {
      const beadTypeId =
        payload.beadTypeId ?? String((row as { bead_type_id: string }).bead_type_id);
      const { data: subType, error: subErr } = await supabase
        .from("sub_bead_types")
        .select("bead_type_id")
        .eq("id", payload.subBeadTypeId)
        .maybeSingle();
      assertNoDbError(subErr);
      if (!subType) {
        throw new ValidationError("subBeadTypeId not found");
      }
      if (String((subType as { bead_type_id: string }).bead_type_id) !== beadTypeId) {
        throw new ValidationError("subBeadTypeId must belong to the selected bead type");
      }
    }

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.beadTypeId !== undefined && { bead_type_id: payload.beadTypeId }),
      ...(payload.subBeadTypeId !== undefined && { sub_bead_type_id: payload.subBeadTypeId }),
      ...(payload.metadata !== undefined && { metadata: payload.metadata }),
      ...(payload.displayOrder !== undefined && { display_order: payload.displayOrder }),
    };

    if (payload.availabilityStatusCode !== undefined) {
      await beadAvailabilityStatusService.getByCode(payload.availabilityStatusCode);
      updates.availability_status_code = payload.availabilityStatusCode;
    } else if (payload.isActive !== undefined) {
      updates.availability_status_code = payload.isActive ? "ACTIVE" : "INACTIVE";
    }

    if (payload.originalImage !== undefined) {
      updates.original_image_url = payload.originalImage.trim();
      specs = mergeSpecs(specs, { legacy_image_url: payload.originalImage.trim() });
    }
    if (payload.processedImage !== undefined) {
      updates.processed_image_url = payload.processedImage.trim();
    }
    if (payload.cropConfig !== undefined) {
      updates.crop_config = payload.cropConfig;
      const fromCrop = processedUrlFromCropConfig(payload.cropConfig);
      if (fromCrop && payload.processedImage === undefined) {
        updates.processed_image_url = fromCrop;
      }
      if (payload.cropStatus === undefined && isBeadCropConfigValid(payload.cropConfig)) {
        updates.crop_status = "ready";
      }
    }
    if (payload.cropStatus !== undefined) {
      updates.crop_status = payload.cropStatus;
    }

    updates.specs = specs;

    const { data, error } = await supabase
      .from("bead_libraries")
      .update(updates)
      .eq("public_id", clientId)
      .select("*, bead_types(slug, name), sub_bead_types(slug, name, bead_type_id)")
      .single();

    assertNoDbError(error);
    const cropChanged =
      payload.cropConfig !== undefined &&
      !cropConfigSemanticallyEqual(
        row.crop_config as BeadCropConfig | null,
        payload.cropConfig as BeadCropConfig | null,
      );
    if (cropChanged) {
      runBackgroundTask("mm-normalization", async () => {
        await mmGroupNormalizationService.recalculateForLibrary(clientId);
      });
    }

    const updatedRow = data as Record<string, unknown>;
    const tags = await tagService.syncBeadLibraryTags(String(updatedRow.id), payload.tags);
    return mapBeadLibraryRow(updatedRow, tags);
  }

  async updateCrop(clientId: string, payload: BeadLibraryCropDTO): Promise<unknown> {
    if (!isBeadCropConfigValid(payload.cropConfig)) {
      throw new ValidationError("cropConfig must include a valid crop region");
    }

    let cropStatus = payload.cropStatus ?? "ready";
    const updates: BeadLibraryUpdateDTO = {
      cropConfig: payload.cropConfig,
      cropStatus,
    };
    if (payload.processedImage !== undefined) {
      updates.processedImage = payload.processedImage;
    }

    return this.update(clientId, updates);
  }

  /**
   * Single-request bead save — avoids duplicate normalization and redundant size sync.
   */
  async saveComplete(
    clientId: string,
    payload: { library: BeadLibraryUpdateDTO; sizes?: SyncLibrarySizesDTO["sizes"] },
  ): Promise<{
    library: Record<string, unknown>;
    sizes: unknown[] | null;
    sizesChanged: boolean;
    cropChanged: boolean;
  }> {
    const existing = (await this.getByClientId(clientId)) as Record<string, unknown>;
    const existingCrop = existing.cropConfig as BeadCropConfig | null;
    const cropChanged =
      payload.library.cropConfig !== undefined &&
      !cropConfigSemanticallyEqual(existingCrop, payload.library.cropConfig as BeadCropConfig | null);

    const library = (await this.update(clientId, payload.library)) as Record<string, unknown>;

    let sizes: unknown[] | null = null;
    let sizesChanged = false;
    if (payload.sizes) {
      const syncResult = await beadLibrarySizeService.syncLibrarySizes(clientId, {
        sizes: payload.sizes,
        skipNormalization: true,
      });
      sizes = syncResult.rows;
      sizesChanged = syncResult.changed;
    }

    if (sizesChanged && !cropChanged) {
      runBackgroundTask("mm-normalization", async () => {
        await mmGroupNormalizationService.recalculateForLibrary(clientId);
      });
    }

    return { library, sizes, sizesChanged, cropChanged };
  }

  async countDesignReferences(clientId: string): Promise<{ designCount: number; itemCount: number }> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase
      .from("bead_libraries")
      .select("id")
      .eq("public_id", clientId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Bead not found");

    const libraryUuid = String((existing as { id: string }).id);

    const { data: sizeRows, error: sizesErr } = await supabase
      .from("bead_library_sizes")
      .select("id")
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(sizesErr);

    const sizeIds = (sizeRows ?? []).map((row) => String((row as { id: string }).id));

    const { data: libRefs, error: libRefErr } = await supabase
      .from("bracelet_configuration_items")
      .select("configuration_id")
      .or(`bead_library_id.eq.${libraryUuid},frame_bead_library_id.eq.${libraryUuid}`);
    assertNoDbError(libRefErr);

    let sizeRefs: { configuration_id: string }[] = [];
    if (sizeIds.length) {
      const list = sizeIds.join(",");
      const { data, error: sizeRefErr } = await supabase
        .from("bracelet_configuration_items")
        .select("configuration_id")
        .or(`bead_library_size_id.in.(${list}),frame_bead_library_size_id.in.(${list})`);
      assertNoDbError(sizeRefErr);
      sizeRefs = (data ?? []) as { configuration_id: string }[];
    }

    const allRefs = [...(libRefs ?? []), ...sizeRefs];
    const configurationIds = new Set(
      allRefs.map((row) => String((row as { configuration_id: string }).configuration_id)),
    );

    return {
      designCount: configurationIds.size,
      itemCount: allRefs.length,
    };
  }

  async remove(clientId: string, options?: { force?: boolean }): Promise<{ message: string }> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase
      .from("bead_libraries")
      .select("id, public_id, name, original_image_url, processed_image_url, crop_config, specs")
      .eq("public_id", clientId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Bead not found");

    const libraryUuid = String((existing as { id: string }).id);
    const beadName = String((existing as { name?: string }).name ?? "This bead").trim() || "This bead";

    const { count: libraryRefCount, error: libraryRefErr } = await supabase
      .from("bracelet_configuration_items")
      .select("id", { count: "exact", head: true })
      .or(`bead_library_id.eq.${libraryUuid},frame_bead_library_id.eq.${libraryUuid}`);
    assertNoDbError(libraryRefErr);

    const { data: sizeRows, error: sizesErr } = await supabase
      .from("bead_library_sizes")
      .select("id, normalized_processed_image_url, normalized_delivery_urls")
      .eq("bead_library_id", libraryUuid);
    assertNoDbError(sizesErr);

    const sizeIds = (sizeRows ?? []).map((row) => String((row as { id: string }).id));
    let sizeRefCount = 0;
    if (sizeIds.length) {
      const list = sizeIds.join(",");
      const { count, error: sizeRefErr } = await supabase
        .from("bracelet_configuration_items")
        .select("id", { count: "exact", head: true })
        .or(`bead_library_size_id.in.(${list}),frame_bead_library_size_id.in.(${list})`);
      assertNoDbError(sizeRefErr);
      sizeRefCount = count ?? 0;
    }

    if (!options?.force && ((libraryRefCount ?? 0) > 0 || sizeRefCount > 0)) {
      throw new ConflictError(
        `Cannot delete "${beadName}" — it is used in saved bracelet designs. Use force delete to remove it from the catalogue while preserving saved designs as replaceable placeholders.`,
      );
    }

    if (options?.force) {
      const { error: snapshotErr } = await supabase
        .from("bracelet_configuration_items")
        .update({ bead_library_public_id_snapshot: clientId })
        .eq("bead_library_id", libraryUuid);
      assertNoDbError(snapshotErr);
    }

    const assetUrls = collectBeadLibraryAssetUrls(
      existing as Record<string, unknown>,
      (sizeRows ?? []) as Record<string, unknown>[],
    );

    const { error: delErr } = await supabase.from("bead_libraries").delete().eq("public_id", clientId);
    assertNoDbError(delErr);

    if (assetUrls.length) {
      runBackgroundTask("bead-library-asset-cleanup", async () => {
        await deleteBeadLibraryAssetUrls(assetUrls);
      });
    }

    return { message: "Bead deleted successfully" };
  }

  /**
   * Refresh visible bounds metadata on all beads from stored crop paths (no recrop).
   */
  async recalculateBoundsMetadata(): Promise<{ updated: number; skipped: number }> {
    const supabase = getSupabaseServiceRole();

    const { data: libraries, error: libErr } = await supabase
      .from("bead_libraries")
      .select("id, crop_config");
    assertNoDbError(libErr);

    let updated = 0;
    let skipped = 0;

    for (const lib of libraries ?? []) {
      const row = lib as { id: string; crop_config: BeadCropConfig | null };
      const cropConfig = row.crop_config;
      if (!cropConfig || !isBeadCropConfigValid(cropConfig)) {
        skipped += 1;
        continue;
      }

      const nextConfig = refreshBeadCropStoredMetrics(cropConfig);
      if (!nextConfig) {
        skipped += 1;
        continue;
      }

      const { error: upErr } = await supabase
        .from("bead_libraries")
        .update({ crop_config: nextConfig })
        .eq("id", row.id);
      assertNoDbError(upErr);
      updated += 1;
    }

    await mmGroupNormalizationService.recalculateAll();

    return { updated, skipped };
  }
}

export const beadLibraryService = new BeadLibraryService();
