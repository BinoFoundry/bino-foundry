import { randomBytes } from "node:crypto";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { slugifyKebab } from "../../lib/slug.js";
import {
  normalizeSubBeadTypeStrandMetadata,
  resolvedTypeStrandProfile,
  subBeadTypeInheritsBeadTypeStrandDefaults,
  parseStrandRenderProfile,
} from "@bino-foundry/shared/types";
import { settingsService } from "../settings/settings.service.js";
import type { SubBeadTypeCreateDTO, SubBeadTypeUpdateDTO } from "./sub-bead-type.validation.js";

function mapSubBeadTypeRow(row: Record<string, unknown>): Record<string, unknown> {
  const beadType = row.bead_types as Record<string, unknown> | null | undefined;
  return {
    id: row.id,
    beadTypeId: row.bead_type_id,
    beadTypeSlug: beadType?.slug ?? undefined,
    beadTypeName: beadType?.name ?? undefined,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    displayOrder: row.display_order,
    isActive: row.is_active !== false,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function allocateSlug(beadTypeId: string, label: string): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const base = slugifyKebab(label);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data, error } = await supabase
      .from("sub_bead_types")
      .select("id")
      .eq("bead_type_id", beadTypeId)
      .eq("slug", candidate)
      .maybeSingle();
    assertNoDbError(error);
    if (!data) return candidate;
  }
  throw new Error("Unable to allocate unique sub_bead_types.slug");
}

async function resolveInheritedProfile(beadTypeId: string): Promise<ReturnType<typeof resolvedTypeStrandProfile>> {
  const supabase = getSupabaseServiceRole();
  const { data: typeRow, error: typeErr } = await supabase
    .from("bead_types")
    .select("metadata")
    .eq("id", beadTypeId)
    .maybeSingle();
  assertNoDbError(typeErr);
  if (!typeRow) throw new NotFoundError("Bead type not found");

  const systemDefaults = await settingsService.getStrandRenderDefaults();
  const typeMeta = (typeRow as { metadata?: Record<string, unknown> }).metadata ?? {};
  const typeDefaults = parseStrandRenderProfile(typeMeta.strandRender);
  return resolvedTypeStrandProfile(typeDefaults, systemDefaults);
}

function normalizeMetadataForSave(
  beadTypeId: string,
  metadata: Record<string, unknown> | undefined,
  inherited: ReturnType<typeof resolvedTypeStrandProfile>,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) };
  if (subBeadTypeInheritsBeadTypeStrandDefaults(base)) {
    return { useBeadTypeStrandDefaults: true };
  }
  return normalizeSubBeadTypeStrandMetadata(base, inherited);
}

export class SubBeadTypeService {
  async list(beadTypeId?: string, options?: { forBuilder?: boolean }): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from("sub_bead_types")
      .select("*, bead_types(slug, name, is_active)")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (beadTypeId) {
      query = query.eq("bead_type_id", beadTypeId);
    }

    if (options?.forBuilder) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? [])
      .filter((row) => {
        if (!options?.forBuilder) return true;
        const typed = row as Record<string, unknown>;
        if (typed.is_active === false) return false;
        const beadType = typed.bead_types as { is_active?: boolean } | null | undefined;
        return beadType?.is_active !== false;
      })
      .map((row) => mapSubBeadTypeRow(row as Record<string, unknown>));
  }

  async get(recordId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sub_bead_types")
      .select("*, bead_types(slug, name)")
      .eq("id", recordId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Sub bead type not found");
    return mapSubBeadTypeRow(data as Record<string, unknown>);
  }

  async create(payload: SubBeadTypeCreateDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const inherited = await resolveInheritedProfile(payload.beadTypeId);
    const slug = await allocateSlug(payload.beadTypeId, payload.name);
    const metadata = normalizeMetadataForSave(payload.beadTypeId, payload.metadata as Record<string, unknown> | undefined, inherited);

    const insertRow = {
      bead_type_id: payload.beadTypeId,
      slug,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? "",
      display_order: payload.displayOrder ?? 0,
      is_active: payload.isActive ?? true,
      metadata,
    };

    const { data, error } = await supabase
      .from("sub_bead_types")
      .insert(insertRow)
      .select("*, bead_types(slug, name)")
      .single();

    assertNoDbError(error);
    return mapSubBeadTypeRow(data as Record<string, unknown>);
  }

  async update(recordId: string, payload: SubBeadTypeUpdateDTO): Promise<unknown> {
    const existing = (await this.get(recordId)) as { beadTypeId: string; metadata?: Record<string, unknown> };
    const beadTypeId = payload.beadTypeId ?? existing.beadTypeId;
    const inherited = await resolveInheritedProfile(beadTypeId);

    const supabase = getSupabaseServiceRole();
    const updates: Record<string, unknown> = {};
    if (payload.beadTypeId !== undefined) updates.bead_type_id = payload.beadTypeId;
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    if (payload.displayOrder !== undefined) updates.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;
    if (payload.metadata !== undefined) {
      updates.metadata = normalizeMetadataForSave(
        beadTypeId,
        payload.metadata as Record<string, unknown>,
        inherited,
      );
    }

    const { data, error } = await supabase
      .from("sub_bead_types")
      .update(updates)
      .eq("id", recordId)
      .select("*, bead_types(slug, name)")
      .single();

    assertNoDbError(error);
    return mapSubBeadTypeRow(data as Record<string, unknown>);
  }

  async remove(recordId: string): Promise<{ message: string }> {
    await this.get(recordId);

    const supabase = getSupabaseServiceRole();
    const { count, error: refErr } = await supabase
      .from("bead_libraries")
      .select("id", { count: "exact", head: true })
      .eq("sub_bead_type_id", recordId);
    assertNoDbError(refErr);
    if ((count ?? 0) > 0) {
      throw new ConflictError(
        "Cannot delete this sub bead type — beads in the library still use it. Reassign or delete those beads first.",
      );
    }

    const { error } = await supabase.from("sub_bead_types").delete().eq("id", recordId);
    assertNoDbError(error);
    return { message: "Sub bead type removed" };
  }
}

export const subBeadTypeService = new SubBeadTypeService();
