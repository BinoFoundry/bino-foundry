import type { ResolvedLensClipRender } from "./clip-settings";

/**
 * Internal compositing orders for true lens replacement.
 * Not exposed in normal admin UI — presets / DEV can set `glassCompositionOrder`.
 *
 * - hybrid (default): Frame Back → Glass → optics → Manual Details → Frame Front
 * - under-frame: Glass stack first, then full frame plate + Manual Details
 * - over-surface: Frame Back first, then glass optics (no separate Frame Front pass)
 */
export type GlassCompositionOrder = "hybrid" | "under-frame" | "over-surface";

/** How the replacement glass body is generated. */
export type GlassBaseSource = "sheet" | "canvas";

/**
 * Internal DEV preview stages — not shown in admin or customer UI.
 * - original: product plate only
 * - glass-base: frame + replacement glass substrate
 * - glass-tint: frame + glass + tint/density (no reflection / edge)
 * - full: complete stack
 */
export type GlassDebugStage = "original" | "glass-base" | "glass-tint" | "full";

export function resolveGlassCompositionOrder(
  render: Pick<ResolvedLensClipRender, "glassCompositionOrder"> | null | undefined,
): GlassCompositionOrder {
  const raw = render?.glassCompositionOrder;
  if (raw === "under-frame" || raw === "over-surface" || raw === "hybrid") return raw;
  return "hybrid";
}

/**
 * Sheet wins when a glass sheet URL is configured (unless explicitly forced to canvas).
 * Otherwise procedural canvas glass.
 */
export function resolveGlassBaseSource(
  render: Pick<ResolvedLensClipRender, "glassSheetUrl" | "glassBaseSource"> | null | undefined,
): GlassBaseSource {
  const hasSheet = Boolean(render?.glassSheetUrl?.trim());
  if (render?.glassBaseSource === "canvas") return "canvas";
  if (render?.glassBaseSource === "sheet") return hasSheet ? "sheet" : "canvas";
  return hasSheet ? "sheet" : "canvas";
}

export function resolveGlassDebugStage(
  render: Pick<ResolvedLensClipRender, "glassDebugStage"> | null | undefined,
): GlassDebugStage {
  const raw = render?.glassDebugStage;
  if (raw === "original" || raw === "glass-base" || raw === "glass-tint" || raw === "full") {
    return raw;
  }
  return "full";
}

/** True whenever lens openings exist — original lens pixels must never be the visual base. */
export function shouldReplaceOriginalLens(lensCount: number): boolean {
  return lensCount > 0;
}
