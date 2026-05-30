import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { BeadTypeCreateDTO, BeadTypeUpdateDTO } from "./bead-type.validation.js";

function mapBeadTypeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    displayOrder: row.display_order,
    isActive: row.is_active,
    usesSizePricing: row.uses_size_pricing === true,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allocateSlug(label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase.from("bead_types").select("id").eq("slug", candidate).maybeSingle();
    assertNoDbError(error);
    if (!data) return candidate;
  }
  throw new Error("Unable to allocate unique bead_types.slug");
}

export class BeadTypeService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_types")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapBeadTypeRow(row as Record<string, unknown>));
  }

  async get(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("bead_types").select("*").eq("id", recordId).maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Bead type not found");
    return mapBeadTypeRow(data as Record<string, unknown>);
  }

  async create(payload: BeadTypeCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const slug = await allocateSlug(payload.name);

    const insertRow = {
      slug,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? "",
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
      uses_size_pricing: payload.usesSizePricing ?? false,
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await supabase.from("bead_types").insert(insertRow).select("*").single();

    assertNoDbError(error);
    return mapBeadTypeRow(data as Record<string, unknown>);
  }

  async update(recordId: string, payload: BeadTypeUpdateDTO): Promise<unknown> {
    await this.get(recordId);

    const supabase = getSupabaseServiceRole();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    if (payload.displayOrder !== undefined) updates.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;
    if (payload.usesSizePricing !== undefined) updates.uses_size_pricing = payload.usesSizePricing;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    const { data, error } = await supabase.from("bead_types").update(updates).eq("id", recordId).select("*").single();

    assertNoDbError(error);
    return mapBeadTypeRow(data as Record<string, unknown>);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.get(recordId);

    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("bead_types").delete().eq("id", recordId);

    assertNoDbError(error);
    return { message: "Bead type removed" };
  }
}

export const beadTypeService = new BeadTypeService();
