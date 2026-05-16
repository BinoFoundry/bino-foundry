/** Stable URL/key-safe slug (`kebab-case`) from arbitrary labels. */
export function slugifyKebab(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length ? s : "item";
}
