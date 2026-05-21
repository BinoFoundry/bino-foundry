/**
 * Shared OpenAPI component schemas (align with Zod DTOs in modules/*).
 */
export const schemas = {
  ApiError: {
    type: "object",
    required: ["success", "error", "message"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "NOT_FOUND" },
          message: { type: "string" },
          details: { nullable: true },
        },
      },
      requestId: { type: "string" },
      message: { type: "string" },
    },
  },
  HealthStatus: {
    type: "object",
    properties: {
      status: { type: "string", example: "ok" },
      app: { type: "string", example: "bino-foundry-api" },
      appEnv: { type: "string", example: "development" },
      nodeEnv: { type: "string", example: "development" },
    },
  },
  LensColor: {
    type: "object",
    properties: {
      colorName: { type: "string" },
      image: { type: "string" },
    },
  },
  Frame: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      price: { type: "number" },
      description: { type: "string" },
      frameImages: { type: "array", items: { type: "string" } },
      lensColors: { type: "array", items: { $ref: "#/components/schemas/LensColor" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  FrameCreate: {
    type: "object",
    required: ["name", "price"],
    properties: {
      name: { type: "string" },
      price: { type: "number", minimum: 0 },
      description: { type: "string" },
      frameImages: { type: "array", items: { type: "string" } },
      lensColors: { type: "array", items: { $ref: "#/components/schemas/LensColor" } },
    },
  },
  Crystal: {
    type: "object",
    properties: {
      id: { type: "string", description: "public_id" },
      name: { type: "string" },
      price: { type: "number" },
      image: { type: "string" },
      type: { type: "string", format: "uuid", nullable: true },
      description: { type: "string" },
    },
  },
  CrystalCreate: {
    type: "object",
    required: ["id", "name", "price"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      price: { type: "number", minimum: 0 },
      image: { type: "string" },
      type: { type: "string", format: "uuid" },
      description: { type: "string" },
    },
  },
  TypeEntry: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string" },
    },
  },
  TypeCreate: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      description: { type: "string" },
    },
  },
  LensTint: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      code: { type: "string" },
      name: { type: "string" },
      category: { type: "string", enum: ["classic", "gradient"] },
      gradientTop: { type: "string", example: "#4a5568" },
      gradientBottom: { type: "string", example: "#2d3748" },
      priceSurcharge: { type: "number" },
      displayOrder: { type: "integer" },
      isActive: { type: "boolean" },
    },
  },
  LensTintCreate: {
    type: "object",
    required: ["code", "name", "category", "gradientTop", "gradientBottom"],
    properties: {
      code: { type: "string" },
      name: { type: "string" },
      category: { type: "string", enum: ["classic", "gradient"] },
      gradientTop: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
      gradientBottom: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
      priceSurcharge: { type: "number", minimum: 0, default: 0 },
      displayOrder: { type: "integer", minimum: 0, default: 0 },
      isActive: { type: "boolean", default: true },
    },
  },
  BuilderOption: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      code: { type: "string", example: "polarized" },
      label: { type: "string" },
      description: { type: "string" },
      priceSurcharge: { type: "number" },
      requiresManualFollowUp: { type: "boolean" },
      tooltipText: { type: "string", nullable: true },
      displayOrder: { type: "integer" },
      isActive: { type: "boolean" },
    },
  },
  BuilderOptionCreate: {
    type: "object",
    required: ["code", "label"],
    properties: {
      code: { type: "string" },
      label: { type: "string" },
      description: { type: "string" },
      priceSurcharge: { type: "number", minimum: 0, default: 0 },
      requiresManualFollowUp: { type: "boolean", default: false },
      tooltipText: { type: "string", nullable: true },
      displayOrder: { type: "integer", minimum: 0, default: 0 },
      isActive: { type: "boolean", default: true },
    },
  },
  SunglassesCatalog: {
    type: "object",
    properties: {
      lensTints: { type: "array", items: { $ref: "#/components/schemas/LensTint" } },
      builderOptions: { type: "array", items: { $ref: "#/components/schemas/BuilderOption" } },
      lensDisclaimer: { type: "string" },
    },
  },
  MessageResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
    },
  },
  UploadStagingResponse: {
    type: "object",
    properties: {
      bucket: { type: "string" },
      objectKey: { type: "string" },
      publicUrl: { type: "string", nullable: true },
    },
  },
} as const;

export const parameters = {
  uuidId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  },
  crystalPublicId: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "Crystal public_id",
  },
  uploadBatch: {
    name: "batch",
    in: "query",
    required: false,
    schema: { type: "string", default: "default" },
  },
} as const;

export const apiKeySecurity = [{ ApiKeyAuth: [] as string[] }];
