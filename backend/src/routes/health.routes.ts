import { Router } from "express";

import { getEnv } from "../config/env.js";
import { sendJson } from "../lib/http-response.js";
import { verifySupabaseCatalogReady } from "../infra/supabase/verify-catalog.js";
import { getSupabaseServiceRole } from "../infra/supabase/adminClient.js";

async function checkDatabase(): Promise<{ ok: boolean; message?: string }> {
  try {
    await verifySupabaseCatalogReady();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Database check failed" };
  }
}

async function checkStorage(): Promise<{ ok: boolean; message?: string }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: true, message: "skipped (Supabase not configured)" };
  }
  try {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.storage.listBuckets();
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Storage check failed" };
  }
}

export function createMonitoringRoutes(): Router {
  const router = Router();

  router.get("/status", (_req, res) => {
    const env = getEnv();
    sendJson(res, {
      status: "ok",
      app: "bino-foundry-api",
      appEnv: env.APP_ENV,
      nodeEnv: env.NODE_ENV,
    });
  });

  router.get("/health", async (_req, res) => {
    const [db, storage] = await Promise.all([checkDatabase(), checkStorage()]);
    const ok = db.ok && storage.ok;
    sendJson(
      res,
      {
        status: ok ? "ok" : "degraded",
        checks: {
          database: db,
          storage,
        },
      },
      ok ? 200 : 503,
    );
  });

  return router;
}
