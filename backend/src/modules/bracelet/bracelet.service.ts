import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { CreateBraceletConfigDTO } from "./bracelet.validation.js";
import { loadBraceletPricingContext, unitPriceWithContext } from "./bracelet-pricing.js";

function newPublicId(): string {
  return `brc_${randomBytes(8).toString("hex")}`;
}

export class BraceletService {
  async createConfiguration(dto: CreateBraceletConfigDTO) {
    if (!dto.items.length) {
      throw new ValidationError("At least one bead must be placed to save a configuration");
    }

    const supabase = getSupabaseServiceRole();
    const pricing = await loadBraceletPricingContext();
    const publicIds = [...new Set(dto.items.map((i) => i.beadLibraryId))];

    const { data: beads, error: beadErr } = await supabase
      .from("bead_libraries")
      .select("id, public_id, unit_price, bead_types(slug)")
      .in("public_id", publicIds);

    assertNoDbError(beadErr);

    const beadByPublicId = new Map(
      (beads ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const type = r.bead_types as { slug?: string } | null;
        return [
          String(r.public_id),
          {
            id: String(r.id),
            unitPrice: Number(r.unit_price),
            slug: type?.slug ?? "crystal",
          },
        ];
      }),
    );

    for (const id of publicIds) {
      if (!beadByPublicId.has(id)) {
        throw new ValidationError(`Unknown bead library id: ${id}`);
      }
    }

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
      })
      .select("id, public_id, status, subtotal, currency_code, created_at, updated_at")
      .single();

    assertNoDbError(configErr);
    if (!config) throw new ValidationError("Failed to create configuration");

    const configId = (config as { id: string }).id;
    const { error: itemsErr } = await supabase.from("bracelet_configuration_items").insert(
      itemRows.map((row) => ({ configuration_id: configId, ...row })),
    );

    assertNoDbError(itemsErr);

    return {
      id: (config as { public_id: string }).public_id,
      status: (config as { status: string }).status,
      subtotal: Number((config as { subtotal: number }).subtotal),
      currencyCode: (config as { currency_code: string }).currency_code,
      itemCount: dto.items.length,
      createdAt: (config as { created_at: string }).created_at,
      updatedAt: (config as { updated_at: string }).updated_at,
    };
  }

  async getConfiguration(publicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data: config, error } = await supabase
      .from("bracelet_configurations")
      .select(
        "id, public_id, status, twinning, wrist_size_cm_a, wrist_size_cm_b, default_bead_size_mm, currency_code, subtotal, item_count, created_at, updated_at",
      )
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(error);
    if (!config) throw new NotFoundError("Bracelet configuration not found");

    const configId = (config as { id: string }).id;
    const { data: items, error: itemsErr } = await supabase
      .from("bracelet_configuration_items")
      .select(
        "strand_index, slot_position, bead_size_mm, unit_price_snapshot, bead_libraries(public_id, name, bead_types(slug))",
      )
      .eq("configuration_id", configId)
      .order("strand_index")
      .order("slot_position");

    assertNoDbError(itemsErr);

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
      items: (items ?? []).map((row) => {
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
        };
      }),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }
}

export const braceletService = new BraceletService();
