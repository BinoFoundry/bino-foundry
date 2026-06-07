import { z } from "zod";

/** Any positive bead diameter in mm (decimals allowed; zero and negatives rejected). */
export const beadSizeMmSchema = z.coerce
  .number({ invalid_type_error: "Bead size must be a number" })
  .positive("Bead size must be greater than 0");

export type BeadSizeMm = z.infer<typeof beadSizeMmSchema>;
