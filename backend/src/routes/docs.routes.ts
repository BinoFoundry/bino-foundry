import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "../openapi/document.js";

/**
 * OpenAPI spec + Swagger UI.
 * Mounted only when `areApiDocsEnabled()` is true (local by default; off in staging/production).
 */
export function createDocsRoutes(): Router {
  const router = Router();

  router.use(
    "/",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Bino Foundry API",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );

  return router;
}
