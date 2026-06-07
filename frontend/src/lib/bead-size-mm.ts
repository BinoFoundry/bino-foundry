/** Returns an error message when invalid, or null when size is a positive number. */
export function validateBeadSizeMm(value: number): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Bead size must be a number";
  }
  if (value <= 0) {
    return "Bead size must be greater than 0";
  }
  return null;
}
