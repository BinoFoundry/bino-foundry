/**
 * Bino Foundry design tokens (TypeScript reference).
 * Canonical values live in `src/index.css` — keep in sync when rebranding.
 */
export const brandColors = {
  warmWhite: "#F5EFE7",
  canvasWarm: "#F2ECE8",
  borderSoft: "#E6DCCF",
  cream: "#F7E6CA",
  softGold: "#E8D59E",
  blush: "#D9BBB0",
  olive: "#404225",
  oliveMuted: "#646345",
  offWhite: "#F5EFE7",
  canvas: "#F2ECE8",
  elevated: "#F0EBE4",
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
  selection: "--selection",
  border: "--border",
  success: "--success",
  warning: "--warning",
  overlay: "--overlay",
  brandWarmWhite: "--brand-warm-white",
  brandCanvasWarm: "--brand-canvas-warm",
  brandBorderSoft: "--brand-border-soft",
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
  primaryHoverBg: "#D9BBB0",
  primaryHoverFg: "#404225",
  secondaryBg: "#F5EFE7",
  secondaryBorder: "#E6DCCF",
  secondaryFg: "#646345",
} as const;

export function hslVar(name: keyof typeof cssVars | string, alpha?: number): string {
  const token = name.startsWith("--") ? name : cssVars[name as keyof typeof cssVars];
  if (alpha !== undefined) return `hsl(var(${token}) / ${alpha})`;
  return `hsl(var(${token}))`;
}
