import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type { CreateBraceletConfigDTO } from "./bracelet.validation.js";
import { beadLibrarySizeService } from "../bead-library-sizes/bead-library-size.service.js";
import { settingsService } from "../settings/settings.service.js";

function newPublicId(): string {
  return `brc_${randomBytes(8).toString("hex")}`;
}

type BeadRow = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  availabilityStatusCode: string;
  showInBuilder: boolean;
  allowNewDesigns: boolean;
};

export class BraceletService {
  private async resolveBeads(publicIds: string[]): Promise<Map<string, BeadRow>> {
    if (!publicIds.length) return new Map();

    const supabase = getSupabaseServiceRole();
    const { data: beads, error } = await supabase
      .from("bead_libraries")
      .select("id, public_id, name, is_active, availability_status_code, bead_types(slug), catalog_availability_statuses(show_in_builder, allow_new_designs)")
      .in("public_id", publicIds);

    assertNoDbError(error);

    const map = new Map<string, BeadRow>();
    for (const row of beads ?? []) {
      const r = row as Record<string, unknown>;
      const type = r.bead_types as { slug?: string } | null;
      const status = r.catalog_availability_statuses as {
        show_in_builder?: boolean;
        allow_new_designs?: boolean;
      } | null;
      map.set(String(r.public_id), {
        id: String(r.id),
        slug: type?.slug ?? "crystal",
        name: String(r.name),
        isActive: r.is_active !== false,
        availabilityStatusCode: String(r.availability_status_code ?? "ACTIVE"),
        showInBuilder: status?.show_in_builder === true,
        allowNewDesigns: status?.allow_new_designs === true,
      });
    }
    return map;
  }

  private validateItemsAgainstCatalog(
    publicIds: string[],
    beadByPublicId: Map<string, BeadRow>,
  ): void {
    const missing: string[] = [];
    const unavailable: string[] = [];
    for (const id of publicIds) {
      const bead = beadByPublicId.get(id);
      if (!bead) missing.push(id);
      else if (!bead.allowNewDesigns) unavailable.push(id);
    }
    if (missing.length) {
      throw new ValidationError(
        `Some beads in this design were removed from the catalogue: ${missing.join(", ")}. Please replace them before saving.`,
      );
    }
    if (unavailable.length) {
      throw new ValidationError(
        "Some items in this design are no longer available. Please replace them before saving your design.",
        { unavailableBeadIds: unavailable },
      );
    }
  }

  async createConfiguration(dto: CreateBraceletConfigDTO, ownerUserId?: string) {
    if (!dto.items.length) {
      throw new ValidationError("At least one bead must be placed to save a configuration");
    }

    const supabase = getSupabaseServiceRole();
    const siteSettings = await settingsService.getGeneralSettings();
    const resolveKeys = dto.items.map((i) => ({
      beadLibraryId: i.beadLibraryId,
      beadSizeMm: i.beadSizeMm!,
    }));
    const sizeByKey = await beadLibrarySizeService.resolveForConfiguration(resolveKeys);
    const publicIds = [...new Set(dto.items.map((i) => i.beadLibraryId))];
    const beadByPublicId = await this.resolveBeads(publicIds);
    this.validateItemsAgainstCatalog(publicIds, beadByPublicId);

    const missingSizes: string[] = [];
    const unavailableSizes: string[] = [];
    let subtotal = 0;
    const itemRows = dto.items.map((item) => {
      const bead = beadByPublicId.get(item.beadLibraryId)!;
      const key = `${item.beadLibraryId}:${item.beadSizeMm}`;
      const offer = sizeByKey.get(key);
      if (!offer) {
        missingSizes.push(`${item.beadLibraryId} @ ${item.beadSizeMm}mm`);
        return null;
      }
      if (offer.libraryUuid !== bead.id) {
        missingSizes.push(`${item.beadLibraryId} @ ${item.beadSizeMm}mm`);
        return null;
      }
      if (offer.availableForNew === false) {
        unavailableSizes.push(`${bead.name} (${offer.sizeMm} mm)`);
        return null;
      }
      const unit = offer.unitPrice;
      subtotal += unit;
      return {
        strand_index: item.strandIndex,
        slot_position: item.slotPosition,
        bead_library_id: bead.id,
        bead_library_size_id: offer.id,
        bead_size_mm: offer.sizeMm,
        unit_price_snapshot: unit,
        bead_library_public_id_snapshot: item.beadLibraryId,
      };
    });

    if (unavailableSizes.length) {
      throw new ValidationError(
        "Some items in this design are no longer available. Please replace them before saving your design.",
        { unavailableSizes: [...new Set(unavailableSizes)] },
      );
    }
    if (missingSizes.length) {
      throw new ValidationError(
        `Some bead sizes in this design are no longer available: ${[...new Set(missingSizes)].join(", ")}. Please replace them before saving.`,
      );
    }
    const rows = itemRows.filter((r): r is NonNullable<typeof r> => r !== null);

    const publicId = newPublicId();
    const { data: config, error: configErr } = await supabase
      .from("bracelet_configurations")
      .insert({
        public_id: publicId,
        status: dto.status,
        twinning: dto.twinning,
        wrist_size_cm_a: dto.wristSizeCmA,
        wrist_size_cm_b: dto.wristSizeCmB,
        default_bead_size_mm: dto.defaultBeadSizeMm ?? null,
        currency_code: siteSettings.currencyCode,
        subtotal,
        item_count: dto.items.length,
        owner_user_id: ownerUserId ?? null,
      })
      .select("id, public_id, status, subtotal, currency_code, item_count, created_at, updated_at")
      .single();

    assertNoDbError(configErr);
    if (!config) throw new ValidationError("Failed to create configuration");

    const configId = (config as { id: string }).id;
    const { error: itemsErr } = await supabase.from("bracelet_configuration_items").insert(
      rows.map((row) => ({ configuration_id: configId, ...row })),
    );

    assertNoDbError(itemsErr);

    return this.mapConfigSummary(config);
  }

  async updateConfiguration(publicId: string, dto: CreateBraceletConfigDTO) {
    if (!dto.items.length) {
      throw new ValidationError("At least one bead must be placed to save a configuration");
    }

    const supabase = getSupabaseServiceRole();
    const { data: existing, error: loadErr } = await supabase
      .from("bracelet_configurations")
      .select("id")
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Bracelet configuration not found");

    const configId = (existing as { id: string }).id;
    const siteSettings = await settingsService.getGeneralSettings();
    const resolveKeys = dto.items.map((i) => ({
      beadLibraryId: i.beadLibraryId,
      beadSizeMm: i.beadSizeMm!,
    }));
    const sizeByKey = await beadLibrarySizeService.resolveForConfiguration(resolveKeys);
    const publicIds = [...new Set(dto.items.map((i) => i.beadLibraryId))];
    const beadByPublicId = await this.resolveBeads(publicIds);
    this.validateItemsAgainstCatalog(publicIds, beadByPublicId);

    const missingSizes: string[] = [];
    const unavailableSizes: string[] = [];
    let subtotal = 0;
    const itemRows = dto.items.map((item) => {
      const bead = beadByPublicId.get(item.beadLibraryId)!;
      const key = `${item.beadLibraryId}:${item.beadSizeMm}`;
      const offer = sizeByKey.get(key);
      if (!offer) {
        missingSizes.push(`${item.beadLibraryId} @ ${item.beadSizeMm}mm`);
        return null;
      }
      if (offer.libraryUuid !== bead.id) {
        missingSizes.push(`${item.beadLibraryId} @ ${item.beadSizeMm}mm`);
        return null;
      }
      if (offer.availableForNew === false) {
        unavailableSizes.push(`${bead.name} (${offer.sizeMm} mm)`);
        return null;
      }
      const unit = offer.unitPrice;
      subtotal += unit;
      return {
        strand_index: item.strandIndex,
        slot_position: item.slotPosition,
        bead_library_id: bead.id,
        bead_library_size_id: offer.id,
        bead_size_mm: offer.sizeMm,
        unit_price_snapshot: unit,
        bead_library_public_id_snapshot: item.beadLibraryId,
      };
    });

    if (unavailableSizes.length) {
      throw new ValidationError(
        "Some items in this design are no longer available. Please replace them before saving your design.",
        { unavailableSizes: [...new Set(unavailableSizes)] },
      );
    }
    if (missingSizes.length) {
      throw new ValidationError(
        `Some bead sizes in this design are no longer available: ${[...new Set(missingSizes)].join(", ")}. Please replace them before saving.`,
      );
    }
    const rows = itemRows.filter((r): r is NonNullable<typeof itemRows[number]> => r !== null);

    const { error: deleteErr } = await supabase
      .from("bracelet_configuration_items")
      .delete()
      .eq("configuration_id", configId);
    assertNoDbError(deleteErr);

    const { error: itemsErr } = await supabase.from("bracelet_configuration_items").insert(
      rows.map((row) => ({ configuration_id: configId, ...row })),
    );
    assertNoDbError(itemsErr);

    const { data: config, error: configErr } = await supabase
      .from("bracelet_configurations")
      .update({
        status: dto.status,
        twinning: dto.twinning,
        wrist_size_cm_a: dto.wristSizeCmA,
        wrist_size_cm_b: dto.wristSizeCmB,
        default_bead_size_mm: dto.defaultBeadSizeMm ?? null,
        subtotal,
        item_count: dto.items.length,
      })
      .eq("public_id", publicId)
      .select("id, public_id, status, subtotal, currency_code, item_count, created_at, updated_at")
      .single();

    assertNoDbError(configErr);
    if (!config) throw new ValidationError("Failed to update configuration");
    return this.mapConfigSummary(config);
  }

  async getConfiguration(publicId: string, options?: { validateCatalog?: boolean }) {
    const supabase = getSupabaseServiceRole();
    const { data: config, error } = await supabase
      .from("bracelet_configurations")
      .select(
        "id, public_id, status, twinning, wrist_size_cm_a, wrist_size_cm_b, default_bead_size_mm, currency_code, subtotal, item_count, owner_user_id, order_reference, created_at, updated_at",
      )
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(error);
    if (!config) throw new NotFoundError("Bracelet configuration not found");

    const configId = (config as { id: string }).id;
    const { data: items, error: itemsErr } = await supabase
      .from("bracelet_configuration_items")
      .select(
        "strand_index, slot_position, bead_size_mm, unit_price_snapshot, bead_library_public_id_snapshot, bead_library_size_id, bead_library_sizes(unit_price, available_for_new, bead_sizes(size_mm, label)), bead_libraries(public_id, name, is_active, availability_status_code, bead_types(slug), catalog_availability_statuses(show_in_builder, allow_new_designs, label))",
      )
      .eq("configuration_id", configId)
      .order("strand_index")
      .order("slot_position");

    assertNoDbError(itemsErr);

    const mappedItems = (items ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const lib = r.bead_libraries as Record<string, unknown> | null;
      const type = lib?.bead_types as { slug?: string } | null;
      const status = lib?.catalog_availability_statuses as {
        show_in_builder?: boolean;
        allow_new_designs?: boolean;
        label?: string;
      } | null;
      const offer = r.bead_library_sizes as Record<string, unknown> | null;
      const sizeRow = offer?.bead_sizes as { size_mm?: number; label?: string } | null;
      const sizeMm = Number(r.bead_size_mm ?? sizeRow?.size_mm ?? 0);
      const snapshotId = String(r.bead_library_public_id_snapshot ?? "").trim();
      const libraryPublicId = String(lib?.public_id ?? snapshotId ?? "");
      const isMissing = !lib;
      const allowNewDesigns = status?.allow_new_designs === true;
      const sizeAvailableForNew = offer == null || offer.available_for_new !== false;
      const catalogIssue = isMissing
        ? "deleted"
        : !allowNewDesigns || !sizeAvailableForNew
          ? "unavailable"
          : null;
      return {
        strandIndex: r.strand_index,
        slotPosition: r.slot_position,
        beadLibraryId: libraryPublicId,
        beadSizeMm: sizeMm,
        offerKey: libraryPublicId ? `${libraryPublicId}-${sizeMm}` : "",
        beadName: lib?.name,
        sizeLabel: sizeRow?.label ?? `${sizeMm} mm`,
        beadTypeSlug: type?.slug,
        unitPrice: Number(r.unit_price_snapshot),
        beadActive: lib ? allowNewDesigns && sizeAvailableForNew : false,
        catalogIssue,
        availabilityStatusCode: lib ? String(lib.availability_status_code ?? "ACTIVE") : null,
        availabilityStatusLabel: status?.label ?? null,
      };
    });

    if (options?.validateCatalog) {
      const ids = mappedItems
        .map((i) => i.beadLibraryId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      if (ids.length) {
        const beadMap = await this.resolveBeads([...new Set(ids)]);
        this.validateItemsAgainstCatalog([...new Set(ids)], beadMap);
      }
    }

    const missingBeadIds = mappedItems
      .filter((i) => i.catalogIssue === "deleted")
      .map((i) => i.beadLibraryId)
      .filter(Boolean) as string[];
    const unavailableBeadIds = mappedItems
      .filter((i) => i.catalogIssue === "unavailable")
      .map((i) => i.beadLibraryId)
      .filter(Boolean) as string[];

    const c = config as Record<string, unknown>;
    return {
      id: c.public_id,
      status: c.status,
      twinning: c.twinning,
      wristSizeCmA: Number(c.wrist_size_cm_a),
      wristSizeCmB: Number(c.wrist_size_cm_b),
      defaultBeadSizeMm: c.default_bead_size_mm,
      currencyCode: c.currency_code,
      subtotal: Number(c.subtotal),
      itemCount: c.item_count,
      ownerUserId: c.owner_user_id ?? null,
      orderReference: c.order_reference ?? null,
      items: mappedItems,
      catalogWarnings:
        missingBeadIds.length || unavailableBeadIds.length
          ? {
              missingBeadIds: [...new Set(missingBeadIds)],
              unavailableBeadIds: [...new Set(unavailableBeadIds)],
              inactiveBeadIds: [...new Set(unavailableBeadIds)],
            }
          : undefined,
      hasCatalogIssues: missingBeadIds.length > 0 || unavailableBeadIds.length > 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  async listConfigurationsForUser(ownerUserId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bracelet_configurations")
      .select("public_id, status, subtotal, currency_code, item_count, created_at, updated_at")
      .eq("owner_user_id", ownerUserId)
      .order("updated_at", { ascending: false })
      .limit(50);

    assertNoDbError(error);
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.public_id,
        status: r.status,
        subtotal: Number(r.subtotal),
        currencyCode: r.currency_code,
        itemCount: r.item_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async recalculatePricing(publicId: string) {
    const existing = await this.getConfiguration(publicId, { validateCatalog: true });
    const resolveKeys = existing.items.map((i) => ({
      beadLibraryId: String(i.beadLibraryId),
      beadSizeMm: Number(i.beadSizeMm),
    }));
    const sizeByKey = await beadLibrarySizeService.resolveForConfiguration(resolveKeys);
    const beadIds = [...new Set(existing.items.map((i) => String(i.beadLibraryId)))];
    const beadMap = await this.resolveBeads(beadIds);

    let subtotal = 0;
    const lineItems = existing.items.map((item) => {
      const bead = beadMap.get(String(item.beadLibraryId))!;
      const key = `${item.beadLibraryId}:${item.beadSizeMm}`;
      const offer = sizeByKey.get(key);
      const unit = offer?.unitPrice ?? Number(item.unitPrice);
      subtotal += unit;
      return {
        beadLibraryId: item.beadLibraryId,
        beadSizeMm: item.beadSizeMm,
        offerKey: offer ? `${item.beadLibraryId}-${offer.sizeMm}` : item.offerKey,
        beadName: bead.name,
        sizeLabel: offer?.label ?? item.sizeLabel,
        beadTypeSlug: item.beadTypeSlug,
        unitPrice: unit,
        lineTotal: unit,
      };
    });

    return {
      configurationId: existing.id,
      currencyCode: existing.currencyCode,
      subtotal,
      itemCount: existing.itemCount,
      lineItems,
      previousSubtotal: existing.subtotal,
    };
  }

  async updateStatus(
    publicId: string,
    status: "saved" | "ordered" | "archived",
    orderReference?: string,
  ) {
    const supabase = getSupabaseServiceRole();
    const { data: existing, error: loadErr } = await supabase
      .from("bracelet_configurations")
      .select("id, status")
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Bracelet configuration not found");

    const current = (existing as { status: string }).status;
    if (status === "ordered" && current !== "saved") {
      throw new ConflictError("Only saved configurations can be marked as ordered");
    }

    const { data, error } = await supabase
      .from("bracelet_configurations")
      .update({
        status,
        order_reference: status === "ordered" ? orderReference ?? null : undefined,
      })
      .eq("public_id", publicId)
      .select("public_id, status, order_reference, updated_at")
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to update configuration status");

    const r = data as Record<string, unknown>;
    return {
      id: r.public_id,
      status: r.status,
      orderReference: r.order_reference ?? null,
      updatedAt: r.updated_at,
    };
  }

  private mapConfigSummary(config: unknown) {
    const c = config as Record<string, unknown>;
    return {
      id: c.public_id,
      status: c.status,
      subtotal: Number(c.subtotal),
      currencyCode: c.currency_code,
      itemCount: Number(c.item_count ?? 0),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }
}

export const braceletService = new BraceletService();
