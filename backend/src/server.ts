import "./config/load-env.js";

import { createApplication } from "./app.js";
import { configureCloudinary } from "./infra/cloudinary.js";
import { verifySupabaseCatalogReady } from "./infra/supabase/verify-catalog.js";
import { getEnv, resolveListenHost } from "./config/env.js";

async function bootstrap(): Promise<void> {
  configureCloudinary();
  const app = createApplication();
  console.log("Verifying Supabase catalogue (Postgres/PostgREST)…");
  await verifySupabaseCatalogReady();

  const port = getEnv().PORT;
  const host = resolveListenHost();
  const { APP_ENV } = getEnv();

  const onListening = () => {
    const where = host ? `${host}:${port}` : `port ${port}`;
    console.log(`Bino Foundry API listening on ${where} (${APP_ENV})`);
    console.log(`Catalogue prefixes: /api · /api/v1`);
    console.log(`Health: /api/status · /api/health`);
    console.log(`Docs:   /api/docs (Swagger UI) · /api/openapi.json`);
    if (APP_ENV === "development") {
      console.log("Mutations guarded when ADMIN_API_KEY is set.");
    }
  };

  if (host) {
    app.listen(port, host, onListening);
  } else {
    app.listen(port, onListening);
  }
}

bootstrap().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
