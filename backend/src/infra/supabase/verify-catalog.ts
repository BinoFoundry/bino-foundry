import { getSupabaseServiceRole } from "./adminClient.js";

/**
 * Smoke-check Postgres catalogue tables via PostgREST (same credentials as Storage).
 * Fails fast when migrations were not applied or env keys are wrong.
 */
export async function verifySupabaseCatalogReady(): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.from("crystal_types").select("id").limit(1);
  if (error) {
    throw new Error(
      `Supabase catalogue unreachable: ${error.message}. Ensure SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set and migrations (000001_initial_catalog.sql) are applied.`,
    );
  }

  const { error: sunglassesError } = await supabase.from("sunglasses_lens_tints").select("id").limit(1);
  if (sunglassesError) {
    throw new Error(
      `Sunglasses builder catalog missing: ${sunglassesError.message}. Apply database/migrations/000003_sunglasses_builder_catalog.sql.`,
    );
  }
}
