import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";
import { approximatePathBounds } from "./glass-material-filter";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/**
 * Procedural / canvas glass body — independent of original lens pixels.
 * Neutral clear plate + subtle material gradient + soft highlight so tint/reflection
 * have a consistent substrate across dark and light SKUs.
 */
export function ProceduralGlassBaseElement({
  uid,
  lens,
  render,
}: {
  uid: string;
  lens: LensClipShape;
  render: ResolvedLensClipRender;
}) {
  const bounds = approximatePathBounds(lens.pathD);
  const { minX, minY, width, height, cx, cy } = bounds;
  const prefix = `${uid}-canvas-glass-${lens.id}`;

  const darkness = clamp01(render.baseGlassDarkness / 100);
  const richness = clamp01(render.baseGlassRichness / 100);
  const transmission = clamp01(render.lensTransmission);

  // Clear → lightly smoked body (never reads original plate colour).
  const bodyAlpha = 0.08 + darkness * 0.42 + (1 - transmission) * 0.28;
  const bodyLum = Math.round(235 - darkness * 150 - richness * 25);
  const bodyColor = `rgb(${bodyLum},${bodyLum + 1},${Math.min(255, bodyLum + 4)})`;

  const gradEnabled = render.densityGradientEnabled || render.gradientEnabled;
  const gStrength = clamp01(
    (render.densityGradientStrength || render.gradientStrength * 100) / 100,
  );
  const shine = clamp01(render.glassSheetShine / 100) * 0.55 + clamp01(render.glossStrength) * 0.35;

  return (
    <g clipPath={`url(#${uid}-glass-${lens.id})`} data-layer="glass-canvas">
      <defs>
        <linearGradient
          id={`${prefix}-body`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={minY}
          x2={cx}
          y2={minY + height}
        >
          <stop offset="0%" stopColor={bodyColor} stopOpacity={bodyAlpha * 0.55} />
          <stop offset="45%" stopColor={bodyColor} stopOpacity={bodyAlpha} />
          <stop offset="100%" stopColor={bodyColor} stopOpacity={bodyAlpha * 1.15} />
        </linearGradient>

        {gradEnabled && gStrength > 0.02 ? (
          <linearGradient
            id={`${prefix}-matte`}
            gradientUnits="userSpaceOnUse"
            x1={cx}
            y1={minY}
            x2={cx}
            y2={minY + height}
          >
            <stop
              offset="0%"
              stopColor={render.densityGradientStartColor || "#e8eef5"}
              stopOpacity={0.22 * gStrength}
            />
            <stop
              offset={`${Math.round(render.densityGradientPosition || render.gradientPosition)}%`}
              stopColor={render.densityGradientEndColor || "#9aa3ad"}
              stopOpacity={0.18 * gStrength}
            />
            <stop
              offset="100%"
              stopColor={render.densityGradientEndColor || "#6b737c"}
              stopOpacity={0.28 * gStrength}
            />
          </linearGradient>
        ) : null}

        <radialGradient
          id={`${prefix}-highlight`}
          gradientUnits="userSpaceOnUse"
          cx={minX + width * 0.36}
          cy={minY + height * 0.28}
          r={Math.max(width, height) * 0.55}
        >
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.38 * shine} />
          <stop offset="42%" stopColor="#eef3f8" stopOpacity={0.12 * shine} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>

        <linearGradient
          id={`${prefix}-band`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={minY + height * 0.18}
          x2={cx}
          y2={minY + height * 0.52}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.16 * shine} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Neutral substrate — tint multiplies / colours this, not the photo lens */}
      <rect
        x={minX - 8}
        y={minY - 8}
        width={width + 16}
        height={height + 16}
        fill="#f4f5f3"
        opacity={0.92}
      />
      <path d={lens.pathD} fill={`url(#${prefix}-body)`} />

      {gradEnabled && gStrength > 0.02 ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${prefix}-matte)`}
          style={{ mixBlendMode: "soft-light" }}
        />
      ) : null}

      {shine > 0.02 ? (
        <>
          <rect
            x={minX - 8}
            y={minY - 8}
            width={width + 16}
            height={height + 16}
            fill={`url(#${prefix}-highlight)`}
            style={{ mixBlendMode: "screen" }}
          />
          <rect
            x={minX - 8}
            y={minY - 8}
            width={width + 16}
            height={height + 16}
            fill={`url(#${prefix}-band)`}
            style={{ mixBlendMode: "screen" }}
          />
        </>
      ) : null}
    </g>
  );
}
