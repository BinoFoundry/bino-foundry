import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type {
  HowWePrepareOptionCreateDTO,
  HowWePrepareOptionUpdateDTO,
} from "./how-we-prepare.validation.js";

function parseBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: String(row.short_description ?? ""),
    fullDescription: String(row.full_description ?? ""),
    optionType: String(row.option_type ?? "preparation"),
    priceType: String(row.price_type ?? "fixed"),
    price: Number(row.price ?? 0),
    priceLabel: String(row.price_label ?? ""),
    defaultQuantity: Number(row.default_quantity ?? 1),
    minimumQuantity: Number(row.minimum_quantity ?? 1),
    maximumQuantity: Number(row.maximum_quantity ?? 1),
    quantityEnabled: Boolean(row.quantity_enabled),
    benefits: parseBenefits(row.benefits),
    highlightTitle: String(row.highlight_title ?? ""),
    highlightDescription: String(row.highlight_description ?? ""),
    badge: row.badge ? String(row.badge) : null,
    status: String(row.status ?? "active"),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function assertQuantityBounds(dto: {
  defaultQuantity?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
}) {
  const min = dto.minimumQuantity;
  const max = dto.maximumQuantity;
  const def = dto.defaultQuantity;
  if (min !== undefined && max !== undefined && min > max) {
    throw new ValidationError("minimumQuantity must be <= maximumQuantity");
  }
  if (def !== undefined && min !== undefined && def < min) {
    throw new ValidationError("defaultQuantity must be >= minimumQuantity");
  }
  if (def !== undefined && max !== undefined && def > max) {
    throw new ValidationError("defaultQuantity must be <= maximumQuantity");
  }
}

export class HowWePrepareService {
  async list(activeOnly = false) {
    const supabase = getSupabaseServiceRole();
    let q = supabase.from("how_we_prepare_options").select("*").order("sort_order").order("slug");
    if (activeOnly) q = q.eq("status", "active");
    const { data, error } = await q;
    assertNoDbError(error);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async get(id: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("how_we_prepare_options")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("How We Prepare option not found");
    return mapRow(data as Record<string, unknown>);
  }

  async create(dto: HowWePrepareOptionCreateDTO) {
    assertQuantityBounds(dto);
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("how_we_prepare_options")
      .insert({
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        short_description: dto.shortDescription?.trim() ?? "",
        full_description: dto.fullDescription?.trim() ?? "",
        option_type: dto.optionType?.trim() ?? "preparation",
        price_type: dto.priceType ?? "fixed",
        price: dto.price ?? 0,
        price_label: dto.priceLabel?.trim() ?? "",
        default_quantity: dto.defaultQuantity ?? 1,
        minimum_quantity: dto.minimumQuantity ?? 1,
        maximum_quantity: dto.maximumQuantity ?? 1,
        quantity_enabled: dto.quantityEnabled ?? false,
        benefits: dto.benefits ?? [],
        highlight_title: dto.highlightTitle?.trim() ?? "",
        highlight_description: dto.highlightDescription?.trim() ?? "",
        badge: dto.badge?.trim() || null,
        status: dto.status ?? "active",
        sort_order: dto.sortOrder ?? 0,
      })
      .select("*")
      .single();

    if (error?.code === "23505") throw new ConflictError("How We Prepare slug already exists");
    assertNoDbError(error);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, dto: HowWePrepareOptionUpdateDTO) {
    const current = await this.get(id);
    assertQuantityBounds({
      defaultQuantity: dto.defaultQuantity ?? current.defaultQuantity,
      minimumQuantity: dto.minimumQuantity ?? current.minimumQuantity,
      maximumQuantity: dto.maximumQuantity ?? current.maximumQuantity,
    });

    const supabase = getSupabaseServiceRole();
    const patch: Record<string, unknown> = {};

    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.slug !== undefined) patch.slug = dto.slug.trim();
    if (dto.shortDescription !== undefined) patch.short_description = dto.shortDescription.trim();
    if (dto.fullDescription !== undefined) patch.full_description = dto.fullDescription.trim();
    if (dto.optionType !== undefined) patch.option_type = dto.optionType.trim();
    if (dto.priceType !== undefined) patch.price_type = dto.priceType;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.priceLabel !== undefined) patch.price_label = dto.priceLabel.trim();
    if (dto.defaultQuantity !== undefined) patch.default_quantity = dto.defaultQuantity;
    if (dto.minimumQuantity !== undefined) patch.minimum_quantity = dto.minimumQuantity;
    if (dto.maximumQuantity !== undefined) patch.maximum_quantity = dto.maximumQuantity;
    if (dto.quantityEnabled !== undefined) patch.quantity_enabled = dto.quantityEnabled;
    if (dto.benefits !== undefined) patch.benefits = dto.benefits;
    if (dto.highlightTitle !== undefined) patch.highlight_title = dto.highlightTitle.trim();
    if (dto.highlightDescription !== undefined) patch.highlight_description = dto.highlightDescription.trim();
    if (dto.badge !== undefined) patch.badge = dto.badge?.trim() || null;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;

    const { data, error } = await supabase
      .from("how_we_prepare_options")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error?.code === "23505") throw new ConflictError("How We Prepare slug already exists");
    assertNoDbError(error);
    if (!data) throw new NotFoundError("How We Prepare option not found");
    return mapRow(data as Record<string, unknown>);
  }

  async remove(id: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("how_we_prepare_options").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "How We Prepare option deleted" };
  }
}

export const howWePrepareService = new HowWePrepareService();
