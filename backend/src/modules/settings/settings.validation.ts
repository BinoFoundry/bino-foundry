import { SUPPORTED_CURRENCY_CODES } from "@bino-foundry/shared/currency";
import { z } from "zod";

export const siteGeneralSettingsDto = z.object({
  currencyCode: z.enum(SUPPORTED_CURRENCY_CODES),
  braceletBuilderLibraryTitle: z.string().trim().min(1).max(80),
});

export const strandRenderDefaultsDto = z.object({
  attachmentStyle: z.enum(["inline", "betweenItems"]),
  strandOccupancy: z.number().min(0.05).max(2),
  contactWidth: z.number().min(0.02).max(2),
  leadingOverlap: z.number().min(0).max(0.5),
  trailingOverlap: z.number().min(0).max(0.5),
  hangOffset: z.number().min(-1).max(1),
  anchorPreset: z.enum(["center", "loop", "top", "bottom"]),
  anchorX: z.number().min(0).max(1),
  anchorY: z.number().min(0).max(1),
  verticalOffset: z.number().min(-1).max(1),
  visualScale: z.number().min(0.25).max(3),
  orientationMode: z.enum(["outward", "inward"]),
  rotationMode: z.enum(["tangent", "radial-upright", "fixed-upright", "none"]),
  rotationOffsetDeg: z.number().min(-180).max(180),
  zPriority: z.number().int().min(-100).max(100),
  collisionPadding: z.number().min(0).max(20),
  stringOcclusion: z.number().min(0).max(1),
  forceRoundFootprint: z.boolean(),
  preferStrandImageUrl: z.boolean(),
});
