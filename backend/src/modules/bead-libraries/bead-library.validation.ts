import { z } from "zod";
const cropStatusSchema = z.enum(["draft", "ready"]);

const normPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const pathAnchorSchema = normPointSchema.extend({
  curved: z.boolean().optional(),
  handleIn: normPointSchema.nullable().optional(),
  handleOut: normPointSchema.nullable().optional(),
});

const beadCropConfigV1Schema = z
  .object({
    version: z.literal(1),
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    originalUrl: z.string().min(1),
    processedUrl: z.string().optional(),
    crop: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    }),
    scale: z.number().positive().optional(),
    shape: z.enum(["circle", "rect"]).optional(),
    autoDetected: z.boolean().optional(),
    updatedAt: z.number().optional(),
  })
  .passthrough();

const beadCropConfigV2Schema = z
  .object({
    version: z.literal(2),
    imageWidth: z.number().positive(),
    imageHeight: z.number().positive(),
    originalUrl: z.string().min(1),
    processedUrl: z.string().optional(),
    points: z.array(pathAnchorSchema).min(3),
    scale: z.number().positive().optional(),
    updatedAt: z.number().optional(),
  })
  .passthrough();

export const beadCropConfigSchema = z.union([beadCropConfigV1Schema, beadCropConfigV2Schema]);

export const beadLibraryCreateSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  price: z.coerce.number().min(0),
  beadTypeId: z.string().uuid(),
  description: z.string().max(5000).optional(),
  originalImage: z.string().optional(),
  processedImage: z.string().optional(),
  image: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  cropConfig: beadCropConfigSchema.nullable().optional(),
  cropStatus: cropStatusSchema.optional(),
});

export const beadLibraryUpdateSchema = beadLibraryCreateSchema
  .omit({ id: true })
  .partial()
  .extend({
    beadTypeId: z.string().uuid().optional(),
  });

export const beadLibraryCropSchema = z.object({
  cropConfig: beadCropConfigSchema,
  cropStatus: cropStatusSchema.optional(),
  processedImage: z.string().optional(),
});

export const createBeadLibraryDto = beadLibraryCreateSchema;
export const updateBeadLibraryDto = beadLibraryUpdateSchema;
export const beadLibraryCropDto = beadLibraryCropSchema;
export const beadLibraryIdParam = z.object({ id: z.string().min(1) });

export type BeadLibraryCreateDTO = z.infer<typeof createBeadLibraryDto>;
export type BeadLibraryUpdateDTO = z.infer<typeof updateBeadLibraryDto>;
export type BeadLibraryCropDTO = z.infer<typeof beadLibraryCropDto>;
