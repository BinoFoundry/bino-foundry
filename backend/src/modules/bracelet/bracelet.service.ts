import { randomBytes } from "node:crypto";

import { DEFAULT_BRACELET_PRICING_RULES, type BraceletPricingRules } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { CreateBraceletConfigDTO } from "./bracelet.validation.js";

const PRICING_KEY = "bracelet.pricing_v1";

function parsePricingRules(value: unknown) {
  if (!value || typeof value !== "object") return DEFAULT_BRACELET_PRICING_RULES;
  const o = value as Record<string, unknown>;
  return {
    sizeMultipliers:
      (o.sizeMultipliers as Record<string, number>) ?? DEFAULT_BRACELET_PRICING_RULES.sizeMultipliers,
    sizePricedTypeSlugs:
      (o.sizePricedTypeSlugs as string[]) ?? DEFAULT_BRACELET_PRICING_RULES.sizePricedTypeSlugs,
    currencyCode:
      typeof o.currencyCode === "string" ? o.currencyCode : DEFAULT_BRACELET_PRICING_RULES.currencyCode,
  };
}

function newPublicId(): string {
  return `brc_${randomBytes(8).toString("hex")}`;
}

function unitPriceForSlug(
  base: number,
  slug: string,
  beadSizeMm: number,
  rules: ReturnType<typeof parsePricingRules>,
): number {
  if (!rules.sizePricedTypeSlugs.includes(slug)) return base;
  const mult = rules.sizeMultipliers[String(beadSizeMm)] ?? 1;
  return base * mult;
}

export class BraceletService {
  async getPricingRules() {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("config_kv")
      .select("value, description")
      .eq("key", PRICING_KEY)
      .maybeSingle();

    assertNoDbError(error);
    return {
      ...parsePricingRules(data?.value ?? null),
      description: typeof data?.description === "string" ? data.description : "",
    };
  }

  async updatePricingRules(payload: BraceletPricingRules & { description?: string }) {
    const supabase = getSupabaseServiceRole();
    const { description, ...rules } = payload;
    const value = {
      sizeMultipliers: rules.sizeMultipliers,
      sizePricedTypeSlugs: rules.sizePricedTypeSlugs,
      currencyCode: rules.currencyCode,
    };

    const { data, error } = await supabase
      .from("config_kv")
      .upsert(
        {
          key: PRICING_KEY,
          value,
          description:
            description?.trim() ||
            "Bracelet builder size multipliers and priced type slugs",
        },
        { onConflict: "key" },
      )
      .select("value, description")
      .single();

    assertNoDbError(error);
    return {
      ...parsePricingRules(data?.value ?? value),
      description: typeof data?.description === "string" ? data.description : "",
    };
  }

  async createConfiguration(dto: CreateBraceletConfigDTO) {
    if (!dto.items.length) {
      throw new ValidationError("At least one bead must be placed to save a configuration");
    }

    const supabase = getSupabaseServiceRole();
    const rules = await this.getPricingRules();
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
      const unit = unitPriceForSlug(bead.unitPrice, bead.slug, item.beadSizeMm, rules);
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
        currency_code: rules.currencyCode,
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
