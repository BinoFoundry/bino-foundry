import type { LensClipShape } from "@bino-foundry/shared/types";
import { insetClosedPathD } from "./inset-path";
import type { PrototypeGlassAppearance } from "./prototype-glass-appearance";

/**
 * SVG material layers for true lens replacement:
 * dark body → tint → density gradient → boundary edge → directional reflection → specular.
 * Drawn above the replacement glass base (sheet or procedural canvas) — never on original lens pixels.
 */
export function PrototypeGlassElement({
  uid,
  lens,
  tintId,
  appearance,
}: {
  uid: string;
  lens: LensClipShape;
  tintId: string;
  appearance: PrototypeGlassAppearance;
}) {
  if (!appearance.glassPresent) return null;

  const { bounds, dark, tint, specular, edge, densityGradient, environmentVisibility } =
    appearance;
  const prefix = `${uid}-pg-${lens.id}`;
  const { minX, minY, width, height, cx, cy } = bounds;
  const rimR1 = Math.max(width, height) * 0.58;
  const soft = Math.max(0.05, Math.min(1, dark.sheenSoft));
  const densityId = `${prefix}-density`;

  const edgeRingD =
    edge.enabled && edge.widthPx > 0
      ? (() => {
          const inset = insetClosedPathD(lens.pathD, edge.widthPx);
          return inset ? `${lens.pathD.trim()} ${inset}` : null;
        })()
      : null;

  return (
    <g clipPath={`url(#${uid}-glass-${lens.id})`}>
      <defs>
        <linearGradient
          id={`${prefix}-darkSheen`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={dark.sheenY1}
          x2={cx}
          y2={dark.sheenY2}
        >
          <stop offset="0%" stopColor={dark.sheenColor} stopOpacity={0} />
          <stop
            offset={`${Math.max(5, 35 * soft)}%`}
            stopColor={dark.sheenColor}
            stopOpacity={0.55 * dark.sheenOpacity}
          />
          <stop offset="50%" stopColor={dark.sheenColor} stopOpacity={0.75 * dark.sheenOpacity} />
          <stop
            offset={`${Math.min(95, 100 - 25 * soft)}%`}
            stopColor={dark.sheenColor}
            stopOpacity={0.25 * dark.sheenOpacity}
          />
          <stop offset="100%" stopColor={dark.sheenColor} stopOpacity={0} />
        </linearGradient>

        <radialGradient
          id={`${prefix}-darkGlowSpec`}
          gradientUnits="userSpaceOnUse"
          cx={dark.glowSpecCx}
          cy={dark.glowSpecCy}
          r={dark.glowSpecRadius}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={dark.glowSpecOpacity} />
          <stop offset="45%" stopColor="#e6ebf5" stopOpacity={dark.glowSpecOpacity * 0.35} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>

        {/* Perimeter thickness rim (tint-aware) — no vertical floor wash. */}
        <radialGradient
          id={`${prefix}-tintRim`}
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r={rimR1}
        >
          <stop offset="0%" stopColor={tint.depthMid} stopOpacity={0} />
          <stop offset="62%" stopColor={tint.depthMid} stopOpacity={0} />
          <stop offset="100%" stopColor={tint.depthMid} stopOpacity={tint.depthRimOpacity} />
        </radialGradient>

        <linearGradient
          id={`${prefix}-tintBand`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={tint.bandY1}
          x2={cx}
          y2={tint.bandY2}
        >
          <stop offset="0%" stopColor={tint.bandTop} stopOpacity={0} />
          <stop offset="45%" stopColor={tint.bandTop} />
          <stop offset="100%" stopColor={tint.bandTop} stopOpacity={0} />
        </linearGradient>

        {edge.enabled && edge.blurPx > 0.05 ? (
          <filter
            id={`${prefix}-edgeBlur`}
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={edge.blurPx} />
          </filter>
        ) : null}

        {densityGradient.enabled ? (
          densityGradient.kind === "radial" ? (
            <radialGradient
              id={densityId}
              gradientUnits="userSpaceOnUse"
              cx={densityGradient.cx}
              cy={densityGradient.cy}
              r={densityGradient.radius}
            >
              {densityGradient.stops.map((stop, index) => (
                <stop
                  key={`d-${index}`}
                  offset={`${Math.round(stop.offset * 100)}%`}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </radialGradient>
          ) : (
            <linearGradient
              id={densityId}
              gradientUnits="userSpaceOnUse"
              x1={densityGradient.x1}
              y1={densityGradient.y1}
              x2={densityGradient.x2}
              y2={densityGradient.y2}
            >
              {densityGradient.stops.map((stop, index) => (
                <stop
                  key={`d-${index}`}
                  offset={`${Math.round(stop.offset * 100)}%`}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </linearGradient>
          )
        ) : null}

        {specular.enabled ? (
          <>
            <linearGradient
              id={`${prefix}-reflectionWash`}
              gradientUnits="userSpaceOnUse"
              x1={specular.cx - specular.radius * 0.9}
              y1={specular.cy - specular.radius * 0.35}
              x2={specular.cx + specular.radius * 1.1}
              y2={specular.cy + specular.radius * 0.85}
            >
              <stop offset="0%" stopColor="#f5f7fa" stopOpacity={specular.peakOpacity * 0.85} />
              <stop offset="42%" stopColor="#c8d0da" stopOpacity={specular.peakOpacity * 0.28} />
              <stop offset="100%" stopColor="#9aa3ad" stopOpacity={0} />
            </linearGradient>
            <radialGradient
              id={`${prefix}-specular`}
              gradientUnits="userSpaceOnUse"
              cx={specular.cx}
              cy={specular.cy}
              r={specular.radius}
            >
              <stop offset="0%" stopColor="#fff" stopOpacity={specular.peakOpacity} />
              <stop offset="40%" stopColor="#fff" stopOpacity={specular.peakOpacity * 0.28} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
          </>
        ) : null}
      </defs>

      {/* 1. Dark material layer — glass body density on replacement substrate */}
      {dark.enabled ? (
        <path
          d={lens.pathD}
          fill={dark.color}
          opacity={dark.opacity}
          style={
            dark.blend === "multiply" ? { mixBlendMode: "multiply" } : undefined
          }
        />
      ) : null}
      {dark.enabled && dark.mode === "gradasi" && dark.sheenOpacity > 1e-4 ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${prefix}-darkSheen)`}
          style={{ mixBlendMode: "screen" }}
        />
      ) : null}
      {dark.enabled && dark.mode === "gradasi" && dark.glowSpecOpacity > 1e-4 ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${prefix}-darkGlowSpec)`}
          style={{ mixBlendMode: "screen" }}
        />
      ) : null}

      {/* 2. Tint material layer */}
      {tint.enabled && tint.blend === "kaca" ? (
        <>
          {tint.colorOpacity > 1e-4 ? (
            <path
              d={lens.pathD}
              fill={`url(#${tintId})`}
              opacity={tint.colorOpacity}
              style={{ mixBlendMode: "color" }}
            />
          ) : null}
          {tint.solidOpacity > 1e-4 ? (
            <path d={lens.pathD} fill={`url(#${tintId})`} opacity={tint.solidOpacity} />
          ) : null}
          {tint.softLightOpacity > 1e-4 ? (
            <path
              d={lens.pathD}
              fill={`url(#${tintId})`}
              opacity={tint.softLightOpacity}
              style={{ mixBlendMode: "soft-light" }}
            />
          ) : null}
        </>
      ) : null}
      {tint.enabled && tint.blend === "color" ? (
        <path
          d={lens.pathD}
          fill={`url(#${tintId})`}
          opacity={tint.opacity}
          style={{ mixBlendMode: "color" }}
        />
      ) : null}
      {tint.enabled && tint.blend === "multiply" ? (
        <path
          d={lens.pathD}
          fill={`url(#${tintId})`}
          opacity={tint.opacity}
          style={{ mixBlendMode: "multiply" }}
        />
      ) : null}
      {tint.enabled && tint.blend === "source-over" ? (
        <path d={lens.pathD} fill={`url(#${tintId})`} opacity={tint.opacity} />
      ) : null}
      {tint.enabled && tint.depth > 0.01 ? (
        <>
          <rect
            x={minX - 4}
            y={minY - 4}
            width={width + 8}
            height={height + 8}
            fill={`url(#${prefix}-tintRim)`}
          />
          <rect
            x={minX - 4}
            y={minY - 4}
            width={width + 8}
            height={height + 8}
            fill={`url(#${prefix}-tintBand)`}
            style={{ mixBlendMode: "soft-light" }}
          />
        </>
      ) : null}

      {/* Optical density gradient — varies absorption across the lens */}
      {densityGradient.enabled ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${densityId})`}
          style={{
            mixBlendMode: densityGradient.twoColor ? "soft-light" : "multiply",
          }}
        />
      ) : null}

      {/* 3. Reflection — directional wash + specular (above tint so dark glass still reads) */}
      {specular.enabled ? (
        <>
          <rect
            x={minX - 8}
            y={minY - 8}
            width={width + 16}
            height={height + 16}
            fill={`url(#${prefix}-reflectionWash)`}
            style={{ mixBlendMode: "screen" }}
            data-layer="glass-reflection"
          />
          <rect
            x={minX - 8}
            y={minY - 8}
            width={width + 16}
            height={height + 16}
            fill={`url(#${prefix}-specular)`}
            style={{ mixBlendMode: "screen" }}
          />
        </>
      ) : null}

      {/* 4. Boundary edge — subtle rim after reflection */}
      {edge.enabled && edgeRingD ? (
        <path
          d={edgeRingD}
          fill={edge.color}
          fillRule="evenodd"
          opacity={edge.opacity}
          filter={edge.blurPx > 0.05 ? `url(#${prefix}-edgeBlur)` : undefined}
          data-layer="lens-edge"
        />
      ) : null}

      {environmentVisibility > 1e-4 ? (
        <path
          d={lens.pathD}
          fill="#d8dee3"
          opacity={environmentVisibility * 0.18}
          style={{ mixBlendMode: "screen" }}
        />
      ) : null}
    </g>
  );
}
