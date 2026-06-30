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
import { beadLibrarySizeService } from "../bead-library-sizes/bead-library-size.service.js";
import { mmGroupNormalizationService } from "../bead-sizes/mm-group-normalization.service.js";
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

function mapBeadLibraryRow(row: Record<string, unknown>): Record<string, unknown> {
  const beadType = row.bead_types as Record<string, unknown> | null | undefined;
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
    description: row.description ?? "",
    metadata: row.metadata ?? {},
    cropConfig: row.crop_config ?? null,
    cropStatus: row.crop_status ?? "draft",
    isActive: row.is_active !== false,
    displayOrder: Number(row.display_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BeadLibraryService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_libraries")
      .select("*, bead_types(slug, name)")
      .order("display_order", { ascending: true })
      .order("public_id", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapBeadLibraryRow(row as Record<string, unknown>));
  }

  async getByClientId(clientId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_libraries")
      .select("*, bead_types(slug, name)")
      .eq("public_id", clientId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead not found");
    return mapBeadLibraryRow(data as Record<string, unknown>);
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

    const insertRow = {
      public_id: payload.id.trim(),
      name: payload.name.trim(),
      currency_code: currencyCode,
      description: payload.description?.trim() ?? "",
      bead_type_id: payload.beadTypeId,
      original_image_url: original,
      processed_image_url: processed,
      crop_config: payload.cropConfig ?? null,
      crop_status: cropStatus,
      metadata: payload.metadata ?? {},
      specs: original ? { legacy_image_url: original } : {},
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
    };

    const { data, error } = await supabase.from("bead_libraries").insert(insertRow).select("*, bead_types(slug, name)").single();

    if (error?.code === "23505") {
      throw new ConflictError("Bead id already exists");
    }
    assertNoDbError(error);

    await beadLibrarySizeService.syncLibrarySizes(payload.id.trim(), {
      sizes: payload.sizes,
    });

    return mapBeadLibraryRow(data as Record<string, unknown>);
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

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.beadTypeId !== undefined && { bead_type_id: payload.beadTypeId }),
      ...(payload.metadata !== undefined && { metadata: payload.metadata }),
      ...(payload.isActive !== undefined && { is_active: payload.isActive }),
      ...(payload.displayOrder !== undefined && { display_order: payload.displayOrder }),
    };

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
      .select("*, bead_types(slug, name)")
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
    return mapBeadLibraryRow(data as Record<string, unknown>);
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

  async remove(clientId: string): Promise<{ message: string }> {
    await this.getByClientId(clientId);

    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("bead_libraries").delete().eq("public_id", clientId);

    assertNoDbError(error);
    return { message: "Bead removed" };
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
