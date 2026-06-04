import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type { CreateBraceletConfigDTO } from "./bracelet.validation.js";
import { loadBraceletPricingContext, unitPriceWithContext } from "./bracelet-pricing.js";

function newPublicId(): string {
  return `brc_${randomBytes(8).toString("hex")}`;
}

type BeadRow = { id: string; unitPrice: number; slug: string; name: string; isActive: boolean };

export class BraceletService {
  private async resolveBeads(publicIds: string[]): Promise<Map<string, BeadRow>> {
    const supabase = getSupabaseServiceRole();
    const { data: beads, error } = await supabase
      .from("bead_libraries")
      .select("id, public_id, name, unit_price, is_active, bead_types(slug)")
      .in("public_id", publicIds);

    assertNoDbError(error);

    const map = new Map<string, BeadRow>();
    for (const row of beads ?? []) {
      const r = row as Record<string, unknown>;
      const type = r.bead_types as { slug?: string } | null;
      map.set(String(r.public_id), {
        id: String(r.id),
        unitPrice: Number(r.unit_price),
        slug: type?.slug ?? "crystal",
        name: String(r.name),
        isActive: r.is_active !== false,
      });
    }
    return map;
  }

  private validateItemsAgainstCatalog(
    publicIds: string[],
    beadByPublicId: Map<string, BeadRow>,
  ): void {
    const missing: string[] = [];
    const inactive: string[] = [];
    for (const id of publicIds) {
      const bead = beadByPublicId.get(id);
      if (!bead) missing.push(id);
      else if (!bead.isActive) inactive.push(id);
    }
    if (missing.length) {
      throw new ValidationError(`Unknown or removed beads: ${missing.join(", ")}`);
    }
    if (inactive.length) {
      throw new ValidationError(`Inactive beads in configuration: ${inactive.join(", ")}`);
    }
  }

  async createConfiguration(dto: CreateBraceletConfigDTO, ownerUserId?: string) {
    if (!dto.items.length) {
      throw new ValidationError("At least one bead must be placed to save a configuration");
    }

    const supabase = getSupabaseServiceRole();
    const pricing = await loadBraceletPricingContext();
    const publicIds = [...new Set(dto.items.map((i) => i.beadLibraryId))];
    const beadByPublicId = await this.resolveBeads(publicIds);
    this.validateItemsAgainstCatalog(publicIds, beadByPublicId);

    let subtotal = 0;
    const itemRows = dto.items.map((item) => {
      const bead = beadByPublicId.get(item.beadLibraryId)!;
      const unit = unitPriceWithContext(bead.unitPrice, bead.slug, item.beadSizeMm, pricing);
      subtotal += unit;
      return {
        strand_index: item.strandIndex,
        slot_position: item.slotPosition,
        bead_library_id: bead.id,
        bead_size_mm: item.beadSizeMm,
        unit_price_snapshot: unit,
      };
    });

    const publicId = newPublicId();
    const { data: config, error: configErr } = await supabase
      .from("bracelet_configurations")
      .insert({
        public_id: publicId,
        status: dto.status,
        twinning: dto.twinning,
        wrist_size_cm_a: dto.wristSizeCmA,
        wrist_size_cm_b: dto.wristSizeCmB,
        default_bead_size_mm: dto.defaultBeadSizeMm,
        currency_code: pricing.currencyCode,
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
      itemRows.map((row) => ({ configuration_id: configId, ...row })),
    );

    assertNoDbError(itemsErr);

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
        "strand_index, slot_position, bead_size_mm, unit_price_snapshot, bead_libraries(public_id, name, is_active, bead_types(slug))",
      )
      .eq("configuration_id", configId)
      .order("strand_index")
      .order("slot_position");

    assertNoDbError(itemsErr);

    const mappedItems = (items ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const lib = r.bead_libraries as Record<string, unknown> | null;
      const type = lib?.bead_types as { slug?: string } | null;
      return {
        strandIndex: r.strand_index,
        slotPosition: r.slot_position,
        beadLibraryId: lib?.public_id,
        beadName: lib?.name,
        beadTypeSlug: type?.slug,
        beadSizeMm: r.bead_size_mm,
        unitPrice: Number(r.unit_price_snapshot),
        beadActive: lib?.is_active !== false,
      };
    });

    if (options?.validateCatalog) {
      const ids = mappedItems
        .map((i) => i.beadLibraryId)
        .filter((id): id is string => typeof id === "string");
      if (ids.length) {
        const beadMap = await this.resolveBeads([...new Set(ids)]);
        this.validateItemsAgainstCatalog([...new Set(ids)], beadMap);
      }
    }

    const staleBeads = mappedItems.filter((i) => i.beadActive === false).map((i) => i.beadLibraryId);

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
      catalogWarnings: staleBeads.length
        ? { inactiveBeadIds: staleBeads.filter(Boolean) as string[] }
        : undefined,
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
    const pricing = await loadBraceletPricingContext();
    const beadIds = [...new Set(existing.items.map((i) => String(i.beadLibraryId)))];
    const beadMap = await this.resolveBeads(beadIds);

    let subtotal = 0;
    const lineItems = existing.items.map((item) => {
      const bead = beadMap.get(String(item.beadLibraryId))!;
      const unit = unitPriceWithContext(bead.unitPrice, bead.slug, Number(item.beadSizeMm), pricing);
      subtotal += unit;
      return {
        beadLibraryId: item.beadLibraryId,
        beadName: bead.name,
        beadTypeSlug: item.beadTypeSlug,
        beadSizeMm: item.beadSizeMm,
        unitPrice: unit,
        lineTotal: unit,
      };
    });

    return {
      configurationId: existing.id,
      currencyCode: pricing.currencyCode,
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
