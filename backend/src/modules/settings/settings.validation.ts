import { SUPPORTED_CURRENCY_CODES } from "@bino-foundry/shared/currency";
import { z } from "zod";

export const siteGeneralSettingsDto = z.object({
  currencyCode: z.enum(SUPPORTED_CURRENCY_CODES),
  braceletBuilderLibraryTitle: z.string().trim().min(1).max(80),
});
