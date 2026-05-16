import { openApiPaths } from "./paths.js";
import { schemas } from "./schemas.js";

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Bino Foundry API",
    version: "1.0.0",
    description: [
      "Catalogue and sunglasses builder API for Bino Foundry (Phase 1).",
      "",
      "**Prefixes:** the same routes are mounted under `/api` and `/api/v1`.",
      "",
      "**Auth:** GET/HEAD/OPTIONS are public. POST/PUT/DELETE require header `x-api-key` when `ADMIN_API_KEY` is set on the server.",
      "Use **Authorize** in Swagger UI with the same value as `ADMIN_API_KEY` / `VITE_ADMIN_API_KEY`.",
      "",
      "**Admin UI:** SPA at `/admin` — Sunglasses config and Media use Sunglasses + Upload tags; product CRUD uses Frames/Crystals/Types (local catalogue sync pending).",
      "",
      "Human-readable docs: repository `docs/api/` (ENDPOINTS.md, SWAGGER.md).",
    ].join("\n"),
    contact: { name: "Bino Foundry" },
  },
  servers: [
    { url: "/api", description: "Default API prefix" },
    { url: "/api/v1", description: "Versioned API prefix" },
  ],
  tags: [
    { name: "Health", description: "Liveness and status" },
    { name: "Frames", description: "Sunglasses frame SKUs" },
    { name: "Crystals", description: "Bracelet beads" },
    { name: "Types", description: "Crystal taxonomy" },
    { name: "Sunglasses", description: "Lens tints, options, frame colours" },
    { name: "Upload", description: "Image staging and upload" },
  ],
  paths: openApiPaths,
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Admin API key (optional Bearer prefix also accepted)",
      },
    },
    schemas,
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
