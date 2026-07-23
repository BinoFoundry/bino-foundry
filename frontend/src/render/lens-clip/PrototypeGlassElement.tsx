import type { LensClipShape } from "@bino-foundry/shared/types";
import type { PrototypeGlassAppearance } from "./prototype-glass-appearance";

/**
 * SVG material layers from `lens-glass-clip.html`:
 * dark body → tint (kaca / color / normal / multiply) → specular.
 * Drawn above the original lens plate (compositor foundation).
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

        <linearGradient
          id={`${prefix}-darkEdge`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={minY + height * 0.35}
          x2={cx}
          y2={minY + height}
        >
          <stop offset="0%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={dark.edgeOpacity * 0.65} />
        </linearGradient>

        <linearGradient
          id={`${prefix}-tintDepth`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={minY}
          x2={cx}
          y2={minY + height}
        >
          <stop offset="0%" stopColor={tint.depthMid} stopOpacity={0} />
          <stop offset="40%" stopColor={tint.depthMid} />
          <stop offset="100%" stopColor={tint.depthBottom} />
        </linearGradient>

        <radialGradient
          id={`${prefix}-tintRim`}
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r={rimR1}
        >
          <stop offset="0%" stopColor="#000" stopOpacity={0} />
          <stop offset="45%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={tint.depthRimOpacity} />
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

        {edge.enabled ? (
          <radialGradient
            id={`${prefix}-edgeDensity`}
            gradientUnits="userSpaceOnUse"
            cx={cx}
            cy={cy}
            r={rimR1}
          >
            <stop offset="0%" stopColor="#000" stopOpacity={0} />
            <stop
              offset={`${Math.max(20, 100 - edge.density * 55)}%`}
              stopColor="#000"
              stopOpacity={0}
            />
            <stop offset="100%" stopColor="#000" stopOpacity={0.45 * edge.opacity * edge.density} />
          </radialGradient>
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
        ) : null}
      </defs>

      {/* 1. Dark material layer — enhances original lens; no synthetic replacement plate */}
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
      {dark.enabled && dark.edgeOpacity > 1e-4 ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${prefix}-darkEdge)`}
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
            fill={`url(#${prefix}-tintDepth)`}
          />
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

      {/* 3. Edge density */}
      {edge.enabled ? (
        <rect
          x={minX - 4}
          y={minY - 4}
          width={width + 8}
          height={height + 8}
          fill={`url(#${prefix}-edgeDensity)`}
        />
      ) : null}

      {/* 4. Specular catch-light */}
      {specular.enabled ? (
        <rect
          x={minX - 8}
          y={minY - 8}
          width={width + 16}
          height={height + 16}
          fill={`url(#${prefix}-specular)`}
          style={{ mixBlendMode: "screen" }}
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
