import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  LENS_RENDER_SYSTEM_DEFAULTS_KEY,
  pickLensRenderPresetSettings,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";
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

function mapMaterialProfile(row: Record<string, unknown>) {
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
  async listMaterialProfiles(includeInactive = false) {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from("lens_material_profiles")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? []).map((row) =>
      mapMaterialProfile(row as Record<string, unknown>),
    );
  }

  async getSystemDefaults(): Promise<LensClipRenderSettings> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("config_kv")
      .select("value")
      .eq("key", LENS_RENDER_SYSTEM_DEFAULTS_KEY)
      .maybeSingle();
    assertNoDbError(error);
    const stored =
      data?.value && typeof data.value === "object" && !Array.isArray(data.value)
        ? (data.value as LensClipRenderSettings)
        : {};
    return {
      ...LENS_RENDER_SYSTEM_DEFAULTS,
      ...pickLensRenderPresetSettings(stored),
    };
  }

  async updateSystemDefaults(
    payload: LensClipRenderSettings,
  ): Promise<LensClipRenderSettings> {
    const supabase = getSupabaseServiceRole();
    const value = {
      ...LENS_RENDER_SYSTEM_DEFAULTS,
      ...pickLensRenderPresetSettings(payload),
    };
    const { data, error } = await supabase
      .from("config_kv")
      .upsert(
        {
          key: LENS_RENDER_SYSTEM_DEFAULTS_KEY,
          value,
          description: "Platform-wide lens material rendering defaults (admin-editable)",
        },
        { onConflict: "key" },
      )
      .select("value")
      .single();
    assertNoDbError(error);
    return {
      ...LENS_RENDER_SYSTEM_DEFAULTS,
      ...pickLensRenderPresetSettings(
        data?.value && typeof data.value === "object"
          ? (data.value as LensClipRenderSettings)
          : value,
      ),
    };
  }

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
    void payload;
    throw new ConflictError(
      "Lens rendering is limited to Clear, Light Tint, Classic Tint, and Dark Tint.",
    );
  }

  async update(id: string, payload: LensRenderPresetUpdateDTO) {
    const existing = await this.getById(id);
    const supabase = getSupabaseServiceRole();

    if (!existing.isSystem && payload.isDefault === true) {
      await clearOtherDefaults(id);
    }

    const patch: Record<string, unknown> = {};
    // Built-in codes stay stable; name/description/settings remain editable.
    if (payload.code !== undefined && !existing.isSystem) patch.code = payload.code;
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.settings !== undefined) patch.settings = payload.settings;
    if (!existing.isSystem && payload.displayOrder !== undefined) {
      patch.display_order = payload.displayOrder;
    }
    if (!existing.isSystem && payload.isActive !== undefined) {
      patch.is_active = payload.isActive;
    }
    if (!existing.isSystem && payload.isDefault !== undefined) {
      patch.is_default = payload.isDefault;
    }
    if (existing.isSystem) {
      patch.is_active = true;
      patch.is_default = existing.code === "classic-tint";
    }

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
    await this.getById(id);
    throw new ConflictError("The four built-in lens rendering presets cannot be duplicated.");
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
