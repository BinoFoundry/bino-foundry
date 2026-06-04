/** Shared lens clip validation for rendering API and admin upserts. */

export function isClipConfigValid(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const c = config as { version?: number; lenses?: unknown[] };
  if (c.version !== 1) return false;
  if (!Array.isArray(c.lenses) || c.lenses.length === 0) return false;
  return c.lenses.some((l) => {
    const pathD = (l as { pathD?: string }).pathD;
    return typeof pathD === "string" && pathD.trim().length > 8;
  });
}

export function clipValidationMessage(config: unknown): string | null {
  if (!config) return "clipConfig is required";
  if (!isClipConfigValid(config)) {
    return "clipConfig must be version 1 with at least one lens containing a valid SVG path (pathD)";
  }
  return null;
}
