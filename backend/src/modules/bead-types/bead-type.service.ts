import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import type { BeadTypeCreateDTO, BeadTypeUpdateDTO } from "./bead-type.validation.js";
import { metadataWithStrandRenderDefaults } from "../strand-render/strand-render-migration.service.js";
import { subBeadTypeService } from "../sub-bead-types/sub-bead-type.service.js";

function mapBeadTypeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    displayOrder: row.display_order,
    isActive: row.is_active,
    enableSubTypes: row.enable_sub_types,
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
    const metadata = metadataWithStrandRenderDefaults(
      slug,
      payload.name.trim(),
      payload.description?.trim() ?? "",
      payload.metadata as Record<string, unknown> | undefined,
    );

    const insertRow = {
      slug,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? "",
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
      enable_sub_types: payload.enableSubTypes ?? false,
      metadata,
    };

    const { data, error } = await supabase.from("bead_types").insert(insertRow).select("*").single();

    assertNoDbError(error);
    const mapped = mapBeadTypeRow(data as Record<string, unknown>);

    await subBeadTypeService.create({
      beadTypeId: String(mapped.id),
      name: "General",
      description: `Default grouping for ${payload.name.trim()}`,
      displayOrder: 0,
      isActive: true,
      metadata: { useBeadTypeStrandDefaults: true },
    });

    return mapped;
  }

  async update(recordId: string, payload: BeadTypeUpdateDTO): Promise<unknown> {
    await this.get(recordId);

    const supabase = getSupabaseServiceRole();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    if (payload.displayOrder !== undefined) updates.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;
    if (payload.enableSubTypes !== undefined) updates.enable_sub_types = payload.enableSubTypes;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    const { data, error } = await supabase.from("bead_types").update(updates).eq("id", recordId).select("*").single();

    assertNoDbError(error);
    return mapBeadTypeRow(data as Record<string, unknown>);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.get(recordId);

    const supabase = getSupabaseServiceRole();
    const { count, error: refErr } = await supabase
      .from("bead_libraries")
      .select("id", { count: "exact", head: true })
      .eq("bead_type_id", recordId);
    assertNoDbError(refErr);
    if ((count ?? 0) > 0) {
      throw new ConflictError(
        "Cannot delete this bead type — beads in the library still use it. Reassign or delete those beads first.",
      );
    }

    const { count: subCount, error: subErr } = await supabase
      .from("sub_bead_types")
      .select("id", { count: "exact", head: true })
      .eq("bead_type_id", recordId);
    assertNoDbError(subErr);
    if ((subCount ?? 0) > 0) {
      throw new ConflictError(
        "Cannot delete this bead type — sub bead types still reference it. Remove those sub-types first.",
      );
    }

    const { error } = await supabase.from("bead_types").delete().eq("id", recordId);

    assertNoDbError(error);
    return { message: "Bead type removed" };
  }
}

export const beadTypeService = new BeadTypeService();
