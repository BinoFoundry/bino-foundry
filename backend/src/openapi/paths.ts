import { apiKeySecurity, parameters } from "./schemas.js";

const errorResponse = {
  description: "Error",
  content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
};

const err = {
  "400": errorResponse,
  "401": errorResponse,
  "404": errorResponse,
  "500": errorResponse,
};

export const openApiPaths = {
  "/status": {
    get: {
      tags: ["Health"],
      summary: "Service status",
      responses: {
        "200": {
          description: "OK",
          content: { "application/json": { schema: { $ref: "#/components/schemas/HealthStatus" } } },
        },
      },
    },
  },
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Liveness probe",
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: { type: "object", properties: { status: { type: "string", example: "ok" } } },
            },
          },
        },
      },
    },
  },
  "/frames": {
    get: {
      tags: ["Frames"],
      summary: "List frames",
      responses: {
        "200": {
          description: "Frame list",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Frame" } } } },
        },
      },
    },
    post: {
      tags: ["Frames"],
      summary: "Create frame",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/FrameCreate" } } },
      },
      responses: {
        "201": {
          description: "Created",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Frame" } } },
        },
        ...err,
      },
    },
  },
  "/frames/{id}": {
    get: {
      tags: ["Frames"],
      summary: "Get frame by UUID",
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Frame", content: { "application/json": { schema: { $ref: "#/components/schemas/Frame" } } } },
        ...err,
      },
    },
    put: {
      tags: ["Frames"],
      summary: "Update frame",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      requestBody: {
        content: { "application/json": { schema: { $ref: "#/components/schemas/FrameCreate" } } },
      },
      responses: {
        "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Frame" } } } },
        ...err,
      },
    },
    delete: {
      tags: ["Frames"],
      summary: "Delete frame",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
  "/crystals": {
    get: {
      tags: ["Crystals"],
      summary: "List crystals",
      responses: {
        "200": {
          description: "Crystal list",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Crystal" } } } },
        },
      },
    },
    post: {
      tags: ["Crystals"],
      summary: "Create crystal",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CrystalCreate" } } },
      },
      responses: {
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Crystal" } } } },
        ...err,
      },
    },
  },
  "/crystals/{id}": {
    get: {
      tags: ["Crystals"],
      summary: "Get crystal by public_id",
      parameters: [parameters.crystalPublicId],
      responses: {
        "200": { description: "Crystal", content: { "application/json": { schema: { $ref: "#/components/schemas/Crystal" } } } },
        ...err,
      },
    },
    put: {
      tags: ["Crystals"],
      summary: "Update crystal",
      security: apiKeySecurity,
      parameters: [parameters.crystalPublicId],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CrystalCreate" } } } },
      responses: {
        "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Crystal" } } } },
        ...err,
      },
    },
    delete: {
      tags: ["Crystals"],
      summary: "Delete crystal",
      security: apiKeySecurity,
      parameters: [parameters.crystalPublicId],
      responses: {
        "200": { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
  "/types": {
    get: {
      tags: ["Types"],
      summary: "List crystal types",
      responses: {
        "200": {
          description: "Type list",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/TypeEntry" } } } },
        },
      },
    },
    post: {
      tags: ["Types"],
      summary: "Create type",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/TypeCreate" } } },
      },
      responses: {
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/TypeEntry" } } } },
        ...err,
      },
    },
  },
  "/types/{id}": {
    get: {
      tags: ["Types"],
      summary: "Get type",
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Type", content: { "application/json": { schema: { $ref: "#/components/schemas/TypeEntry" } } } },
        ...err,
      },
    },
    put: {
      tags: ["Types"],
      summary: "Update type",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/TypeCreate" } } } },
      responses: {
        "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/TypeEntry" } } } },
        ...err,
      },
    },
    delete: {
      tags: ["Types"],
      summary: "Delete type",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
  "/sunglasses/catalog": {
    get: {
      tags: ["Sunglasses"],
      summary: "Public sunglasses builder catalog",
      responses: {
        "200": {
          description: "Active catalog",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SunglassesCatalog" } } },
        },
      },
    },
  },
  "/sunglasses/catalog/admin": {
    get: {
      tags: ["Sunglasses"],
      summary: "Admin catalog (includes inactive)",
      responses: {
        "200": {
          description: "Full catalog",
          content: { "application/json": { schema: { $ref: "#/components/schemas/SunglassesCatalog" } } },
        },
      },
    },
  },
  "/sunglasses/lens-tints": {
    get: {
      tags: ["Sunglasses"],
      summary: "List lens tints",
      responses: {
        "200": {
          description: "Lens tints",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/LensTint" } } } },
        },
      },
    },
    post: {
      tags: ["Sunglasses"],
      summary: "Create lens tint",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/LensTintCreate" } } },
      },
      responses: {
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/LensTint" } } } },
        ...err,
      },
    },
  },
  "/sunglasses/lens-tints/{id}": {
    put: {
      tags: ["Sunglasses"],
      summary: "Update lens tint",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/LensTintCreate" } } } },
      responses: {
        "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/LensTint" } } } },
        ...err,
      },
    },
    delete: {
      tags: ["Sunglasses"],
      summary: "Delete lens tint",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
  "/sunglasses/options": {
    get: {
      tags: ["Sunglasses"],
      summary: "List builder options",
      responses: {
        "200": {
          description: "Options",
          content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/BuilderOption" } } } },
        },
      },
    },
    post: {
      tags: ["Sunglasses"],
      summary: "Create builder option",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/BuilderOptionCreate" } } },
      },
      responses: {
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/BuilderOption" } } } },
        ...err,
      },
    },
  },
  "/sunglasses/options/{id}": {
    put: {
      tags: ["Sunglasses"],
      summary: "Update builder option",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/BuilderOptionCreate" } } } },
      responses: {
        "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/BuilderOption" } } } },
        ...err,
      },
    },
    delete: {
      tags: ["Sunglasses"],
      summary: "Delete builder option",
      security: apiKeySecurity,
      parameters: [parameters.uuidId],
      responses: {
        "200": { description: "Deleted", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
  "/upload/staging": {
    post: {
      tags: ["Upload"],
      summary: "Upload image to private staging bucket",
      security: apiKeySecurity,
      parameters: [parameters.uploadBatch],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["image"],
              properties: {
                image: { type: "string", format: "binary", description: "Image file" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Staged",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UploadStagingResponse" } } },
        },
        ...err,
      },
    },
  },
  "/upload": {
    post: {
      tags: ["Upload"],
      summary: "Upload image (Cloudinary or Supabase assets)",
      security: apiKeySecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["image"],
              properties: {
                image: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Uploaded" },
        ...err,
      },
    },
  },
  "/rendering/frames/{frameId}/bundle": {
    get: {
      tags: ["Rendering"],
      summary: "Get frame render bundle (front/side masks)",
      parameters: [{ name: "frameId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": { description: "Render bundle" },
        ...err,
      },
    },
  },
  "/rendering/frames/{frameId}/views/{viewAxis}": {
    put: {
      tags: ["Rendering"],
      summary: "Upsert masked view plate + polygon config",
      security: apiKeySecurity,
      parameters: [
        { name: "frameId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "viewAxis", in: "path", required: true, schema: { type: "string", enum: ["front", "side"] } },
      ],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": { description: "View saved" },
        ...err,
      },
    },
    delete: {
      tags: ["Rendering"],
      summary: "Remove render view",
      security: apiKeySecurity,
      parameters: [
        { name: "frameId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "viewAxis", in: "path", required: true, schema: { type: "string", enum: ["front", "side"] } },
      ],
      responses: {
        "200": { description: "Removed", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" } } } },
        ...err,
      },
    },
  },
};
