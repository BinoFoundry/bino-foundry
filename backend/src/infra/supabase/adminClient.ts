import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "../../config/env.js";

let singleton: SupabaseClient | null = null;

/**
 * Singleton Supabase admin client using the **service role** key.
 * Bypasses Storage RLS; must run **only on the backend** (never in the SPA bundle).
 */
export function getSupabaseServiceRole(): SupabaseClient {
  if (!singleton) {
    const env = getEnv();
    const url = env.SUPABASE_URL?.trim();
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceKey) {
      throw new Error("Supabase is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required).");
    }
    singleton = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return singleton;
}
