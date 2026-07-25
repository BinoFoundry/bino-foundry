import { SUPPORTED_CURRENCY_CODES } from "@bino-foundry/shared/currency";
import {
  BEAD_RENDER_CALIBRATION_FACTOR_MAX,
  BEAD_RENDER_CALIBRATION_FACTOR_MIN,
  DEFAULT_SITE_GENERAL_SETTINGS,
  STRAND_CONTACT_SPACING_MAX,
  STRAND_CONTACT_SPACING_MIN,
  clampBeadRenderCalibrationFactor,
} from "@bino-foundry/shared/types";
import { z } from "zod";

export const siteGeneralSettingsDto = z.object({
  currencyCode: z.enum(SUPPORTED_CURRENCY_CODES),
  braceletBuilderLibraryTitle: z.string().trim().min(1).max(80),
  beadRenderCalibrationFactor: z
    .number()
    .min(BEAD_RENDER_CALIBRATION_FACTOR_MIN)
    .max(BEAD_RENDER_CALIBRATION_FACTOR_MAX)
    .default(DEFAULT_SITE_GENERAL_SETTINGS.beadRenderCalibrationFactor),
});

export const strandRenderDefaultsDto = z.object({
  layoutScale: z.number().min(0.9).max(1.1).default(1),
  balanceSpacing: z.boolean().default(true),
  attachmentStyle: z.enum(["inline", "betweenItems"]),
  strandOccupancy: z.number().min(0.05).max(2),
  contactWidth: z.number().min(STRAND_CONTACT_SPACING_MIN).max(STRAND_CONTACT_SPACING_MAX),
  layoutMode: z.enum(["inline", "dangling"]).default("inline"),
  contactOffset: z.number().min(STRAND_CONTACT_SPACING_MIN).max(STRAND_CONTACT_SPACING_MAX).default(0),
  spacingAdjustment: z
    .number()
    .min(STRAND_CONTACT_SPACING_MIN)
    .max(STRAND_CONTACT_SPACING_MAX)
    .default(0),
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
