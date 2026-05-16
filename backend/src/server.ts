import "./config/load-env.js";

import { createApplication } from "./app.js";
import { configureCloudinary } from "./infra/cloudinary.js";
import { verifySupabaseCatalogReady } from "./infra/supabase/verify-catalog.js";
import { getEnv } from "./config/env.js";

async function bootstrap(): Promise<void> {
  configureCloudinary();
  const app = createApplication();
  console.log("Verifying Supabase catalogue (Postgres/PostgREST)…");
  await verifySupabaseCatalogReady();

  const port = getEnv().PORT;

  const { APP_ENV } = getEnv();

  app.listen(port, () => {
    console.log(`Bino Foundry API listening on port ${port} (${APP_ENV})`);
    console.log(`Catalogue prefixes: /api · /api/v1`);
    console.log(`Health: /api/status · /api/health`);
    console.log(`Docs:   /api/docs (Swagger UI) · /api/openapi.json`);
    if (APP_ENV === "development") {
      console.log("Mutations guarded when ADMIN_API_KEY is set.");
    }
  });
}

bootstrap().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
