import { z } from "zod";

export const siteGeneralSettingsDto = z.object({
  currencyCode: z.string().length(3).toUpperCase(),
});
