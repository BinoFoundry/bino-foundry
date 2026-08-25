import "./config/load-env.js";

import { createApplication } from "./app.js";
import { configureCloudinary } from "./infra/cloudinary.js";
import { verifySupabaseCatalogReady } from "./infra/supabase/verify-catalog.js";
import { strandRenderMigrationService } from "./modules/strand-render/strand-render-migration.service.js";
import { getEnv, areApiDocsEnabled, resolveListenHost } from "./config/env.js";

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
    console.log(`Health: /api/status (public) · /api/health (keyed in staging/production)`);
    if (areApiDocsEnabled()) {
      console.log(`Docs:   /api/docs (Swagger UI) · /api/openapi.json`);
    } else {
      console.log("Docs:   disabled (set ENABLE_API_DOCS=1 to enable temporarily)");
    }
    if (APP_ENV === "development") {
      console.log("Mutations guarded when ADMIN_API_KEY is set.");
    }

    void strandRenderMigrationService
      .runStartupMigration()
      .then((stats) => {
        if (
          stats.typesInitialized > 0 ||
          stats.typesKeysFilled > 0 ||
          stats.subTypesRepaired > 0 ||
          stats.subTypeClientCopyEnriched > 0 ||
          stats.librariesCleaned > 0
        ) {
          console.log(
            `Strand render migration: ${stats.typesInitialized} type(s) initialized, ${stats.typesKeysFilled} type key-fill(s), ${stats.subTypesRepaired} sub-type repair(s), ${stats.subTypeClientCopyEnriched} sub-type label(s) enriched, ${stats.librariesCleaned} library override(s) cleaned.`,
          );
        }
      })
      .catch((error) => {
        console.warn("Strand render startup migration skipped:", error);
      });
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
