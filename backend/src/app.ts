import cors from "cors";
import express, { type Application } from "express";

import { corsOriginAllowlist, getEnv } from "./config/env.js";
import { NotFoundError } from "./lib/errors.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { logger } from "./lib/logger.js";
import { mutationRateLimit } from "./middleware/rate-limit.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import { createUsersRoutes } from "./modules/users/users.routes.js";
import { createCatalogRoutes } from "./routes/catalog.routes.js";
import { openApiDocument } from "./openapi/document.js";
import { createDocsRoutes } from "./routes/docs.routes.js";
import { createMonitoringRoutes } from "./routes/health.routes.js";

const API_PREFIXES = ["/api", "/api/v1"] as const;

function buildCorsConfiguration(): cors.CorsOptions {
  const allowlist = corsOriginAllowlist();
  if (!allowlist) {
    return {
      origin: true,
      credentials: false,
    };
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowlist.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  };
}

export function createApplication(): Application {
  const app = express();
  const { TRUST_PROXY } = getEnv();

  app.disable("x-powered-by");
  if (TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.use(requestContextMiddleware);
  app.use(cors(buildCorsConfiguration()));
  app.use(mutationRateLimit);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  const monitoring = createMonitoringRoutes();
  const catalogue = createCatalogRoutes();
  const docs = createDocsRoutes();

  for (const base of API_PREFIXES) {
    app.get(`${base}/openapi.json`, (_req, res) => {
      res.json(openApiDocument);
    });
    app.use(`${base}/auth`, createAuthRoutes());
    app.use(`${base}/users`, createUsersRoutes());
    app.use(base, monitoring);
    app.use(`${base}/docs`, docs);
    app.use(base, catalogue);
  }

  app.get("/", (_req, res) => {
    const links = API_PREFIXES.map(
      (p) =>
        `<a href="${p}/status">${p}/status</a> · <a href="${p}/docs">${p}/docs</a> (Swagger)`,
    ).join("<br/>");
    res.send(
      `Bino Foundry Backend API — ${links}<br/><small>Set ADMIN_API_KEY to require <code>x-api-key</code> on mutations.</small>`,
    );
  });

  app.use((_req, _res, next) => next(new NotFoundError("Route not found")));
  app.use(createErrorHandler(logger));

  return app;
}
