import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import type {
  LensRenderPresetCreateDTO,
  LensRenderPresetUpdateDTO,
} from "./lens-render-preset.validation.js";

function mapPreset(row: Record<string, unknown>) {
  const settings =
    row.settings !== null && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description ?? ""),
    settings,
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
    isDefault: Boolean(row.is_default),
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function clearOtherDefaults(exceptId?: string): Promise<void> {
  const supabase = getSupabaseServiceRole();
  let query = supabase
    .from("lens_rendering_presets")
    .update({ is_default: false })
    .eq("is_default", true);
  if (exceptId) {
    query = query.neq("id", exceptId);
  }
  const { error } = await query;
  assertNoDbError(error);
}

export class LensRenderPresetService {
  async list(includeInactive: boolean) {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from("lens_rendering_presets")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? []).map((row) => mapPreset(row as Record<string, unknown>));
  }

  async getById(id: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("lens_rendering_presets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Lens rendering preset not found");
    return mapPreset(data as Record<string, unknown>);
  }

  async create(payload: LensRenderPresetCreateDTO) {
    const supabase = getSupabaseServiceRole();
    if (payload.isDefault) {
      await clearOtherDefaults();
    }

    const { data, error } = await supabase
      .from("lens_rendering_presets")
      .insert({
        code: payload.code,
        name: payload.name,
        description: payload.description ?? "",
        settings: payload.settings ?? {},
        display_order: payload.displayOrder ?? 0,
        is_active: payload.isActive ?? true,
        is_default: payload.isDefault ?? false,
        is_system: false,
      })
      .select("*")
      .single();

    assertNoDbError(error);
    return mapPreset(data as Record<string, unknown>);
  }

  async update(id: string, payload: LensRenderPresetUpdateDTO) {
    const existing = await this.getById(id);
    const supabase = getSupabaseServiceRole();

    if (payload.isDefault === true) {
      await clearOtherDefaults(id);
    }

    const patch: Record<string, unknown> = {};
    // Built-in codes stay stable; name/description/settings remain editable.
    if (payload.code !== undefined && !existing.isSystem) patch.code = payload.code;
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.settings !== undefined) patch.settings = payload.settings;
    if (payload.displayOrder !== undefined) patch.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) patch.is_active = payload.isActive;
    if (payload.isDefault !== undefined) patch.is_default = payload.isDefault;

    const { data, error } = await supabase
      .from("lens_rendering_presets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    assertNoDbError(error);
    return mapPreset(data as Record<string, unknown>);
  }

  async duplicate(id: string) {
    const source = await this.getById(id);
    const baseCode = `${source.code}-copy`;
    let code = baseCode;
    let attempt = 1;
    const supabase = getSupabaseServiceRole();

    // Ensure unique code.
    while (attempt < 20) {
      const { data, error } = await supabase
        .from("lens_rendering_presets")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      assertNoDbError(error);
      if (!data) break;
      attempt += 1;
      code = `${baseCode}-${attempt}`;
    }

    return this.create({
      code,
      name: `${source.name} (copy)`,
      description: source.description,
      settings: source.settings,
      displayOrder: source.displayOrder + 1,
      isActive: source.isActive,
      isDefault: false,
    });
  }

  async remove(id: string) {
    const existing = await this.getById(id);
    if (existing.isSystem) {
      throw new ConflictError(
        `Cannot delete built-in preset "${existing.name}". Built-in presets can be edited but not deleted.`,
      );
    }
    if (existing.isDefault) {
      throw new ConflictError("Cannot delete the default lens rendering preset. Assign another default first.");
    }

    const supabase = getSupabaseServiceRole();
    const { count, error: countErr } = await supabase
      .from("frames")
      .select("id", { count: "exact", head: true })
      .eq("lens_render_preset_id", id);
    assertNoDbError(countErr);

    if ((count ?? 0) > 0) {
      throw new ConflictError(
        `Cannot delete "${existing.name}" — ${count} frame(s) still use this preset. Reassign them first.`,
      );
    }

    const { error } = await supabase.from("lens_rendering_presets").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Lens rendering preset deleted successfully" };
  }
}

export const lensRenderPresetService = new LensRenderPresetService();
