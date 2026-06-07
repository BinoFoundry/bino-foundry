/**
 * Bino Foundry design tokens (TypeScript reference).
 * Canonical values live in `src/index.css` — keep in sync when rebranding.
 */
export const brandColors = {
  cream: "#F7E6CA",
  softGold: "#E8D59E",
  blush: "#D9BBB0",
  olive: "#404225",
  oliveMuted: "#646345",
  offWhite: "#FBF8F3",
  canvas: "#FFFFFF",
  elevated: "#FDFCF9",
} as const;

/** Surface roles — canonical CSS vars in `src/index.css`. */
export const surfaces = {
  page: "hsl(var(--surface-page))",
  card: "hsl(var(--surface-card))",
  elevated: "hsl(var(--surface-elevated))",
  muted: "hsl(var(--surface-muted))",
  canvas: "hsl(var(--surface-canvas))",
} as const;

/** CSS custom property names (use with hsl(var(--name))). */
export const cssVars = {
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  card: "--card",
  canvas: "--canvas",
  highlight: "--highlight",
  decorative: "--decorative",
  border: "--border",
  success: "--success",
  warning: "--warning",
  overlay: "--overlay",
  brandCream: "--brand-cream",
  brandOlive: "--brand-olive",
  brandSoftGold: "--brand-soft-gold",
  brandBlush: "--brand-blush",
} as const;

/** Typography tokens — canonical values in `src/index.css`. */
export const typography = {
  display: '"Playfair Display", Georgia, serif',
  body: 'Inter, system-ui, sans-serif',
} as const;

/** Button palette — canonical CSS vars in `src/index.css`. */
export const buttonTokens = {
  primaryBg: "#404225",
  primaryFg: "#FFFFFF",
  primaryHover: "hsl(64 22% 28%)",
  secondaryBg: "#FFFFFF",
  secondaryBorder: "#646345",
  secondaryFg: "#646345",
} as const;

export function hslVar(name: keyof typeof cssVars | string, alpha?: number): string {
  const token = name.startsWith("--") ? name : cssVars[name as keyof typeof cssVars];
  if (alpha !== undefined) return `hsl(var(${token}) / ${alpha})`;
  return `hsl(var(${token}))`;
}
