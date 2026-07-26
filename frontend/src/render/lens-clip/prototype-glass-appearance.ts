import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";
import {
  approximatePathBounds,
  resolveLensReflectionSide,
  resolveReflectionAppearanceForSide,
  resolveReflectionTransformForSide,
  type LensPathBounds,
} from "./glass-material-filter";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function applyDensityCurve(
  t: number,
  curve: ResolvedLensClipRender["densityGradientCurve"],
): number {
  const x = clamp01(t);
  switch (curve) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default:
      return x;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return rgb(lerp(ar, br, t), lerp(ag, bg, t), lerp(ab, bb, t));
}

/**
 * Build gradient stops with independent start/end falloff.
 * Low start falloff → leave start almost immediately.
 * High end falloff → approach end gradually.
 */
export function buildDensityGradientStops(input: {
  startFalloff: number;
  endFalloff: number;
  position: number;
  curve: ResolvedLensClipRender["densityGradientCurve"];
  startColor: string;
  endColor: string;
  twoColor: boolean;
}): Array<{ offset: number; color: string; opacity: number }> {
  const startF = clamp01(input.startFalloff / 100);
  const endF = clamp01(input.endFalloff / 100);
  const mid = clamp01(input.position / 100);

  // Start plateau: high startF holds start colour longer toward mid.
  const startHold = startF * Math.max(0.04, mid * 0.95);
  // End approach: high endF begins the end colour earlier and softens into it.
  const endHold = endF * Math.max(0.04, (1 - mid) * 0.95);
  const transitionStart = startHold;
  const transitionEnd = Math.max(transitionStart + 0.04, 1 - endHold);

  const sampleOffsets = [0, 0.08, 0.18, 0.32, 0.5, 0.68, 0.82, 0.92, 1];
  return sampleOffsets.map((raw) => {
    let mix: number;
    if (raw <= transitionStart) {
      mix = 0;
    } else if (raw >= transitionEnd) {
      mix = 1;
    } else {
      const u = (raw - transitionStart) / (transitionEnd - transitionStart);
      mix = applyDensityCurve(u, input.curve);
    }

    const color = input.twoColor
      ? mixHex(input.startColor, input.endColor, mix)
      : "#000000";
    // Opacity follows the transition so falloff shapes optical density, not just hue.
    const opacity = input.twoColor
      ? lerp(0.42, 0.82, mix)
      : lerp(0.08, 0.62, mix);
    return { offset: raw, color, opacity };
  });
}


function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length < 6) return [143, 24, 48];
  return [
    Number.parseInt(h.slice(0, 2), 16) || 0,
    Number.parseInt(h.slice(2, 4), 16) || 0,
    Number.parseInt(h.slice(4, 6), 16) || 0,
  ];
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp01(a).toFixed(4)})`;
}

/**
 * Per-lens appearance from Lens Rendering Preset material layers,
 * matching `Bino Asset/lens-glass-clip.html`:
 * original lens (compositor) → dark → tint (kaca) → specular.
 */
export interface PrototypeGlassAppearance {
  bounds: LensPathBounds;
  /** False when no material layers should draw (identity / show original plate). */
  glassPresent: boolean;
  dark: {
    enabled: boolean;
    opacity: number;
    color: string;
    blend: "source-over" | "multiply";
    mode: "flat" | "gradasi";
    sheenOpacity: number;
    sheenColor: string;
    sheenY1: number;
    sheenY2: number;
    sheenSoft: number;
    glowSpecCx: number;
    glowSpecCy: number;
    glowSpecRadius: number;
    glowSpecOpacity: number;
    edgeOpacity: number;
  };
  tint: {
    enabled: boolean;
    blend: "kaca" | "color" | "source-over" | "multiply";
    /** Overall tint opacity (prototype tint.opacity). */
    opacity: number;
    colorOpacity: number;
    solidOpacity: number;
    softLightOpacity: number;
    depth: number;
    depthMid: string;
    depthBottom: string;
    depthRimOpacity: number;
    bandTop: string;
    bandY1: number;
    bandY2: number;
  };
  specular: {
    enabled: boolean;
    cx: number;
    cy: number;
    radius: number;
    peakOpacity: number;
  };
  edge: {
    enabled: boolean;
    density: number;
    opacity: number;
  };
  densityGradient: {
    enabled: boolean;
    kind: "linear" | "radial";
    twoColor: boolean;
    /** Linear axis */
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    /** Radial */
    cx: number;
    cy: number;
    radius: number;
    stops: Array<{ offset: number; color: string; opacity: number }>;
  };
  environmentVisibility: number;
}

/**
 * Map admin/preset material-layer settings onto the prototype glass appearance model.
 * Tint HEX is supplied by the customer tint — never altered here.
 * The original lens remains underneath in the compositor; these layers enhance it.
 */
export function resolvePrototypeGlassAppearance(
  render: ResolvedLensClipRender,
  tintHex: string,
  lens: LensClipShape,
  lenses: LensClipShape[],
): PrototypeGlassAppearance {
  const bounds = approximatePathBounds(lens.pathD);
  const { minX, minY, width, height, cx, cy } = bounds;

  const darkOn = render.darkLayerEnabled;
  const darkOp = darkOn ? clamp01(render.darkLayerOpacity / 100) : 0;
  const tintOn = render.glassTintEnabled;
  const tintOp = tintOn ? clamp01(render.tintLayerOpacity) : 0;
  const depth = tintOn ? clamp01(render.glassDepth / 100) : 0;
  const shine = clamp01(render.glassTintShine / 100);
  // Background visibility / environment transmission retired with Glass Sheet.
  const env = 0;
  const edgeOn = render.edgeEnabled;
  const edgeDensity = edgeOn ? clamp01(render.edgeDensity) : 0;
  const edgeOpacityAmt = edgeOn ? clamp01(render.edgeOpacity) : 0;

  // Density gradient retired with Glass Sheet architecture.
  const densityOn = false;

  const glassPresent =
    darkOp > 1e-4 ||
    tintOp > 1e-4 ||
    densityOn ||
    (render.reflectionEnabled && shine > 0.02) ||
    edgeDensity * edgeOpacityAmt > 1e-4 ||
    env > 1e-4;

  const [tr, tg, tb] = parseHex(tintHex);
  const [dr, dg, db] = parseHex(render.darkLayerColor);

  // Dark layer — prototype buildDarkLayer (flat fill + optional gradasi sheen).
  const glow = clamp01(render.darkLayerGlow / 100);
  const glowSize = clamp01(render.darkLayerGlowSize / 100);
  const glowX = clamp01(render.darkLayerGlowX / 100);
  const glowY = clamp01(render.darkLayerGlowY / 100);
  const soft = clamp01(render.darkLayerSoft / 100);
  const darkEdge = clamp01(render.darkLayerEdge / 100);
  const gLift = 0.18 + glow * 0.55;
  const sheenColor = rgb(
    dr + (175 - dr) * gLift,
    dg + (180 - dg) * gLift,
    db + (190 - db) * gLift,
  );
  const bandY = minY + height * glowY;
  const bandH = height * (0.18 + glowSize * 0.55);
  const sheenOpacity =
    render.darkLayerMode === "gradasi" && darkOp > 1e-4 ? glow : 0;
  const glowSpecCx = minX + width * glowX;
  const glowSpecCy = bandY - bandH * 0.15;
  const glowSpecRadius = Math.min(width, height) * (0.18 + glowSize * 0.22);
  const glowSpecOpacity = render.darkLayerMode === "gradasi" ? 0.28 * glow : 0;

  // Tint stack — prototype applyTintLayer ratios.
  const colorOpacity = tintOn && render.glassTintBlend === "kaca" ? Math.min(1, tintOp * 1.05) : 0;
  const solidOpacity =
    tintOn && render.glassTintBlend === "kaca"
      ? tintOp * 0.62
      : tintOn && render.glassTintBlend === "source-over"
        ? tintOp
        : 0;
  const softLightOpacity =
    tintOn && render.glassTintBlend === "kaca" ? tintOp * 0.35 : 0;
  const singleBlendOpacity =
    tintOn && (render.glassTintBlend === "color" || render.glassTintBlend === "multiply")
      ? tintOp
      : 0;
  const depthFactor = 0.35 + (1 - depth) * 0.4;
  const depthMid = rgba(tr * depthFactor, tg * depthFactor, tb * depthFactor, 0.15 * depth);
  const depthBottom = rgba(tr * depthFactor, tg * depthFactor, tb * depthFactor, 0.55 * depth);
  const bandTop = rgba(
    tr + (255 - tr) * 0.42,
    tg + (255 - tg) * 0.38,
    tb + (255 - tb) * 0.35,
    0.28,
  );
  const tintBandY = minY + height * 0.32;

  // Specular — prototype drawSpecular (tint.shine), gated by Enable Reflection.
  const side = resolveLensReflectionSide(lens, lenses);
  const transform = resolveReflectionTransformForSide(render, side);
  const appearance = resolveReflectionAppearanceForSide(render, side);
  const shineAmt = render.reflectionEnabled
    ? clamp01(shine * (0.55 + appearance.opacity * 0.9) + render.glossStrength * 0.2)
    : 0;
  const angleRad = (transform.angle * Math.PI) / 180;
  const orbit = 0.22 * transform.scale;
  const ox = transform.offsetX / 100;
  const oy = transform.offsetY / 100;
  const specCx = cx + width * (ox * 0.28 + Math.cos(angleRad) * orbit * 0.55 - 0.12);
  const specCy = cy + height * (oy * 0.22 + Math.sin(angleRad) * orbit * 0.35 - 0.22);
  const specR =
    Math.min(width, height) *
    (0.28 + transform.scale * 0.22) *
    (0.85 + (1 - appearance.softBlur) * 0.25);

  // Density gradient — retired; stub geometry kept for type compatibility.
  const twoColor = false;
  const densityStops: Array<{ offset: number; color: string; opacity: number }> = [];
  const densityKind: "linear" | "radial" = "linear";
  const dx1 = cx;
  const dy1 = minY;
  const dx2 = cx;
  const dy2 = minY + height;
  const dRadius = Math.max(width, height) * 0.62;

  return {
    bounds,
    glassPresent,
    dark: {
      enabled: darkOn && darkOp > 1e-4,
      opacity: darkOp,
      color: render.darkLayerColor,
      blend: render.darkLayerBlend,
      mode: render.darkLayerMode,
      sheenOpacity,
      sheenColor,
      sheenY1: bandY - bandH * 0.7,
      sheenY2: bandY + bandH * 0.9,
      sheenSoft: soft,
      glowSpecCx,
      glowSpecCy,
      glowSpecRadius: Math.max(4, glowSpecRadius),
      glowSpecOpacity,
      edgeOpacity: render.darkLayerMode === "gradasi" ? darkEdge : 0,
    },
    tint: {
      enabled: tintOn && tintOp > 1e-4,
      blend: render.glassTintBlend,
      opacity: tintOp,
      colorOpacity: render.glassTintBlend === "kaca" ? colorOpacity : singleBlendOpacity,
      solidOpacity,
      softLightOpacity,
      depth,
      depthMid,
      depthBottom,
      depthRimOpacity: 0.28 * depth,
      bandTop,
      bandY1: tintBandY - height * 0.22,
      bandY2: tintBandY + height * 0.28,
    },
    specular: {
      enabled: render.reflectionEnabled && shineAmt > 0.02,
      cx: specCx,
      cy: specCy,
      radius: Math.max(8, specR),
      peakOpacity: 0.42 * clamp01(shineAmt),
    },
    edge: {
      enabled: edgeOn && edgeDensity * edgeOpacityAmt > 1e-4,
      density: edgeDensity,
      opacity: edgeOpacityAmt,
    },
    densityGradient: {
      enabled: densityOn,
      kind: densityKind,
      twoColor,
      x1: dx1,
      y1: dy1,
      x2: dx2,
      y2: dy2,
      cx,
      cy,
      radius: Math.max(8, dRadius),
      stops: densityStops,
    },
    environmentVisibility: env,
  };
}
