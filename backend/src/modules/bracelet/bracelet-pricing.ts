import { settingsService } from "../settings/settings.service.js";
import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";

export interface BraceletPricingContext {
  sizeMultipliers: Map<string, number>;
  sizePricedSlugs: Set<string>;
  currencyCode: string;
}

export async function loadBraceletPricingContext(): Promise<BraceletPricingContext> {
  const supabase = getSupabaseServiceRole();
  const [sizesRes, typesRes, siteSettings] = await Promise.all([
    supabase.from("bead_sizes").select("size_mm, price_multiplier").eq("is_active", true),
    supabase.from("bead_types").select("slug, uses_size_pricing").eq("is_active", true),
    settingsService.getGeneralSettings(),
  ]);

  assertNoDbError(sizesRes.error);
  assertNoDbError(typesRes.error);

  const sizeMultipliers = new Map<string, number>(
    (sizesRes.data ?? []).map((row) => {
      const r = row as { size_mm: number; price_multiplier: number };
      return [String(r.size_mm), Number(r.price_multiplier)];
    }),
  );

  const sizePricedSlugs = new Set<string>(
    (typesRes.data ?? [])
      .filter((row) => (row as { uses_size_pricing: boolean }).uses_size_pricing)
      .map((row) => String((row as { slug: string }).slug)),
  );

  return {
    sizeMultipliers,
    sizePricedSlugs,
    currencyCode: siteSettings.currencyCode,
  };
}

export function unitPriceWithContext(
  base: number,
  slug: string,
  beadSizeMm: number,
  ctx: BraceletPricingContext,
): number {
  if (!ctx.sizePricedSlugs.has(slug)) return base;
  const mult = ctx.sizeMultipliers.get(String(beadSizeMm)) ?? 1;
  return base * mult;
}
