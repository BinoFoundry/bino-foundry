import {
  clampBeadRenderCalibrationFactor,
  DEFAULT_SITE_GENERAL_SETTINGS,
  DEFAULT_STRAND_RENDER_PROFILE,
  mergeStrandRenderProfile,
  parseStrandRenderProfile,
  strandRenderStorageMeta,
  STRAND_RENDER_SYSTEM_DEFAULTS_KEY,
  type SiteGeneralSettings,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

export const SITE_SETTINGS_KEY = "site.settings_v1";
export { STRAND_RENDER_SYSTEM_DEFAULTS_KEY };

function parseSiteSettings(value: unknown): SiteGeneralSettings {
  if (!value || typeof value !== "object") return DEFAULT_SITE_GENERAL_SETTINGS;
  const o = value as Record<string, unknown>;
  const code =
    typeof o.currencyCode === "string" && o.currencyCode.length === 3
      ? o.currencyCode.toUpperCase()
      : DEFAULT_SITE_GENERAL_SETTINGS.currencyCode;
  const titleRaw = o.braceletBuilderLibraryTitle;
  const braceletBuilderLibraryTitle =
    typeof titleRaw === "string" && titleRaw.trim()
      ? titleRaw.trim()
      : DEFAULT_SITE_GENERAL_SETTINGS.braceletBuilderLibraryTitle;
  return {
    currencyCode: code,
    braceletBuilderLibraryTitle,
    beadRenderCalibrationFactor: clampBeadRenderCalibrationFactor(o.beadRenderCalibrationFactor),
  };
}

function parseStrandRenderDefaults(value: unknown): StrandRenderProfile {
  const partial = parseStrandRenderProfile(value);
  return mergeStrandRenderProfile(DEFAULT_STRAND_RENDER_PROFILE, partial);
}

function serializeStrandRenderDefaults(profile: StrandRenderProfile): Record<string, unknown> {
  return {
    ...mergeStrandRenderProfile(profile),
    ...strandRenderStorageMeta(),
  };
}

export class SettingsService {
  async getGeneralSettings(): Promise<SiteGeneralSettings> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("config_kv")
      .select("value")
      .eq("key", SITE_SETTINGS_KEY)
      .maybeSingle();

    assertNoDbError(error);
    return parseSiteSettings(data?.value ?? null);
  }

  async updateGeneralSettings(payload: SiteGeneralSettings): Promise<SiteGeneralSettings> {
    const supabase = getSupabaseServiceRole();
    const current = await this.getGeneralSettings();
    const value = {
      currencyCode: payload.currencyCode.toUpperCase(),
      braceletBuilderLibraryTitle:
        payload.braceletBuilderLibraryTitle?.trim() || current.braceletBuilderLibraryTitle,
      beadRenderCalibrationFactor: clampBeadRenderCalibrationFactor(
        payload.beadRenderCalibrationFactor ?? current.beadRenderCalibrationFactor,
      ),
    };

    const { data, error } = await supabase
      .from("config_kv")
      .upsert(
        {
          key: SITE_SETTINGS_KEY,
          value,
          description: "Site-wide general settings (currency for all builders and checkout)",
        },
        { onConflict: "key" },
      )
      .select("value")
      .single();

    assertNoDbError(error);
    return parseSiteSettings(data?.value ?? value);
  }

  async getStrandRenderDefaults(): Promise<StrandRenderProfile> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("config_kv")
      .select("value")
      .eq("key", STRAND_RENDER_SYSTEM_DEFAULTS_KEY)
      .maybeSingle();

    assertNoDbError(error);
    return parseStrandRenderDefaults(data?.value ?? null);
  }

  async updateStrandRenderDefaults(payload: StrandRenderProfile): Promise<StrandRenderProfile> {
    const supabase = getSupabaseServiceRole();
    const value = serializeStrandRenderDefaults(payload);

    const { data, error } = await supabase
      .from("config_kv")
      .upsert(
        {
          key: STRAND_RENDER_SYSTEM_DEFAULTS_KEY,
          value,
          description: "Bracelet builder strand rendering system defaults",
        },
        { onConflict: "key" },
      )
      .select("value")
      .single();

    assertNoDbError(error);
    return parseStrandRenderDefaults(data?.value ?? value);
  }
}

export const settingsService = new SettingsService();
