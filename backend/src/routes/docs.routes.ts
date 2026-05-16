import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "../openapi/document.js";

/**
 * OpenAPI spec + Swagger UI (no API key required).
 * Mount at `/api/docs` and `/api/v1/docs` via app.ts.
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
