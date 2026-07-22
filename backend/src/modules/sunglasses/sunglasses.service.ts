import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { NotFoundError } from "../../lib/errors.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { lensRenderPresetService } from "./lens-render-preset.service.js";
import type {
  BuilderOptionCreateDTO,
  BuilderOptionUpdateDTO,
  LensTintCreateDTO,
  LensTintUpdateDTO,
} from "./sunglasses.validation.js";

function mapLensTint(row: Record<string, unknown>) {
  const category = row.category === "classic" ? "classic" : "gradient";
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category,
    gradientTop: row.gradient_top,
    gradientBottom: row.gradient_bottom,
    opacity: Number(row.opacity ?? (category === "classic" ? 0.52 : 0.58)),
    gradientDirection: row.gradient_direction ?? "top-to-bottom",
    gradientAngle: Number(row.gradient_angle ?? 180),
    gradientMidPosition: Number(row.gradient_mid_position ?? 50),
    gradientIntensity: Number(row.gradient_intensity ?? 0.55),
    priceSurcharge: Number(row.price_surcharge),
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBuilderOption(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description ?? "",
    priceSurcharge: Number(row.price_surcharge),
    requiresManualFollowUp: Boolean(row.requires_manual_follow_up),
    tooltipText: row.tooltip_text ?? null,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readLensDisclaimer(): Promise<string> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("config_kv")
    .select("value")
    .eq("key", "sunglasses.lens_disclaimer")
    .maybeSingle();

  assertNoDbError(error);
  if (!data?.value) {
    return "Lens appearance may vary slightly from the final product.";
  }
  if (typeof data.value === "string") return data.value;
  return String(data.value);
}

export class SunglassesCatalogService {
  async getCatalog() {
    const [
      lensTints,
      builderOptions,
      lensDisclaimer,
      lensRenderPresets,
      lensRenderSystemDefaults,
      lensMaterialProfiles,
    ] = await Promise.all([
      this.listLensTints(false),
      this.listBuilderOptions(false),
      readLensDisclaimer(),
      lensRenderPresetService.list(false),
      lensRenderPresetService.getSystemDefaults(),
      lensRenderPresetService.listMaterialProfiles(false),
    ]);

    return {
      lensTints: lensTints.filter((t) => t.isActive),
      builderOptions: builderOptions.filter((o) => o.isActive),
      lensRenderPresets: lensRenderPresets.filter((p) => p.isActive),
      lensRenderSystemDefaults,
      lensMaterialProfiles,
      lensDisclaimer,
    };
  }

  async getAdminCatalog() {
    const [
      lensTints,
      builderOptions,
      lensDisclaimer,
      lensRenderPresets,
      lensRenderSystemDefaults,
      lensMaterialProfiles,
    ] = await Promise.all([
      this.listLensTints(true),
      this.listBuilderOptions(true),
      readLensDisclaimer(),
      lensRenderPresetService.list(true),
      lensRenderPresetService.getSystemDefaults(),
      lensRenderPresetService.listMaterialProfiles(true),
    ]);
    return {
      lensTints,
      builderOptions,
      lensRenderPresets,
      lensRenderSystemDefaults,
      lensMaterialProfiles,
      lensDisclaimer,
    };
  }

  async listLensTints(includeInactive: boolean) {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from("sunglasses_lens_tints")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? []).map((row) => mapLensTint(row as Record<string, unknown>));
  }

  async createLensTint(payload: LensTintCreateDTO) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_lens_tints")
      .insert({
        code: payload.code,
        name: payload.name,
        category: payload.category,
        gradient_top: payload.gradientTop,
        gradient_bottom:
          payload.category === "classic" ? payload.gradientTop : payload.gradientBottom,
        opacity: payload.opacity ?? (payload.category === "classic" ? 0.52 : 0.58),
        gradient_direction: payload.gradientDirection ?? "top-to-bottom",
        gradient_angle: payload.gradientAngle ?? 180,
        gradient_mid_position: payload.gradientMidPosition ?? 50,
        gradient_intensity: payload.gradientIntensity ?? 0.55,
        price_surcharge: payload.priceSurcharge ?? 0,
        display_order: payload.displayOrder ?? 0,
        is_active: payload.isActive ?? true,
      })
      .select("*")
      .single();

    assertNoDbError(error);
    return mapLensTint(data as Record<string, unknown>);
  }

  async updateLensTint(id: string, payload: LensTintUpdateDTO) {
    const supabase = getSupabaseServiceRole();
    const patch: Record<string, unknown> = {};
    if (payload.code !== undefined) patch.code = payload.code;
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.category !== undefined) patch.category = payload.category;
    if (payload.gradientTop !== undefined) patch.gradient_top = payload.gradientTop;
    if (payload.gradientBottom !== undefined) patch.gradient_bottom = payload.gradientBottom;
    if (payload.category === "classic" && payload.gradientTop !== undefined) {
      patch.gradient_bottom = payload.gradientTop;
    }
    if (payload.opacity !== undefined) patch.opacity = payload.opacity;
    if (payload.gradientDirection !== undefined) patch.gradient_direction = payload.gradientDirection;
    if (payload.gradientAngle !== undefined) patch.gradient_angle = payload.gradientAngle;
    if (payload.gradientMidPosition !== undefined) patch.gradient_mid_position = payload.gradientMidPosition;
    if (payload.gradientIntensity !== undefined) patch.gradient_intensity = payload.gradientIntensity;
    if (payload.priceSurcharge !== undefined) patch.price_surcharge = payload.priceSurcharge;
    if (payload.displayOrder !== undefined) patch.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) patch.is_active = payload.isActive;

    const { data, error } = await supabase
      .from("sunglasses_lens_tints")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Lens tint not found");
    return mapLensTint(data as Record<string, unknown>);
  }

  async removeLensTint(id: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("sunglasses_lens_tints").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Lens tint deleted" };
  }

  async listBuilderOptions(includeInactive: boolean) {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from("sunglasses_builder_options")
      .select("*")
      .order("display_order", { ascending: true })
      .order("label", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? []).map((row) => mapBuilderOption(row as Record<string, unknown>));
  }

  async createBuilderOption(payload: BuilderOptionCreateDTO) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_builder_options")
      .insert({
        code: payload.code,
        label: payload.label,
        description: payload.description ?? "",
        price_surcharge: payload.priceSurcharge ?? 0,
        requires_manual_follow_up: payload.requiresManualFollowUp ?? false,
        tooltip_text: payload.tooltipText ?? null,
        display_order: payload.displayOrder ?? 0,
        is_active: payload.isActive ?? true,
      })
      .select("*")
      .single();

    assertNoDbError(error);
    return mapBuilderOption(data as Record<string, unknown>);
  }

  async updateBuilderOption(id: string, payload: BuilderOptionUpdateDTO) {
    const supabase = getSupabaseServiceRole();
    const patch: Record<string, unknown> = {};
    if (payload.code !== undefined) patch.code = payload.code;
    if (payload.label !== undefined) patch.label = payload.label;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.priceSurcharge !== undefined) patch.price_surcharge = payload.priceSurcharge;
    if (payload.requiresManualFollowUp !== undefined) {
      patch.requires_manual_follow_up = payload.requiresManualFollowUp;
    }
    if (payload.tooltipText !== undefined) patch.tooltip_text = payload.tooltipText;
    if (payload.displayOrder !== undefined) patch.display_order = payload.displayOrder;
    if (payload.isActive !== undefined) patch.is_active = payload.isActive;

    const { data, error } = await supabase
      .from("sunglasses_builder_options")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Builder option not found");
    return mapBuilderOption(data as Record<string, unknown>);
  }

  async removeBuilderOption(id: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("sunglasses_builder_options").delete().eq("id", id);
    assertNoDbError(error);
    return { message: "Builder option deleted" };
  }

}

export const sunglassesCatalogService = new SunglassesCatalogService();
