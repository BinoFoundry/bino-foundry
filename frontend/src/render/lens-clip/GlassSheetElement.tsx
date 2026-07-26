import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";
import { approximatePathBounds } from "./glass-material-filter";
import { computeGlassSheetPlacement } from "./glass-sheet-layout";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

/** True when a glass sheet asset is configured — sheet is always used when present. */
export function isGlassSheetActive(render: Pick<ResolvedLensClipRender, "glassSheetUrl">): boolean {
  return Boolean(render.glassSheetUrl?.trim());
}

/**
 * Glass sheet foundation inside a lens clip (texture only).
 * Customer colour comes from the Tint Layer (`PrototypeGlassElement`) above this.
 * Original lens pixels are not drawn.
 */
export function GlassSheetElement({
  uid,
  lens,
  render,
}: {
  uid: string;
  lens: LensClipShape;
  render: ResolvedLensClipRender;
}) {
  const url = render.glassSheetUrl?.trim();
  if (!url) return null;

  const bounds = approximatePathBounds(lens.pathD);
  const { minX, minY, width, height, cx, cy } = bounds;
  const texStrength = clamp01(render.glassSheetTextureStrength / 100);
  const shine = clamp01(render.glassSheetShine / 100);
  const prefix = `${uid}-sheet-${lens.id}`;

  const natW = render.glassSheetNaturalWidth ?? 1024;
  const natH = render.glassSheetNaturalHeight ?? 576;
  const placement = computeGlassSheetPlacement({
    bounds,
    naturalWidth: natW,
    naturalHeight: natH,
    crop: render.glassSheetCrop,
    fit: render.glassSheetFit,
    scale: render.glassSheetScale,
    offsetX: render.glassSheetOffsetX,
    offsetY: render.glassSheetOffsetY,
  });

  const sheetImage = (
    <svg
      x={placement.x}
      y={placement.y}
      width={placement.width}
      height={placement.height}
      viewBox={`${placement.viewBox.x} ${placement.viewBox.y} ${placement.viewBox.width} ${placement.viewBox.height}`}
      preserveAspectRatio="none"
      overflow="visible"
    >
      <image
        href={url}
        x={0}
        y={0}
        width={natW}
        height={natH}
        preserveAspectRatio="none"
        crossOrigin="anonymous"
      />
    </svg>
  );

  return (
    <g clipPath={`url(#${uid}-glass-${lens.id})`} data-layer="glass-sheet">
      <defs>
        <radialGradient
          id={`${prefix}-shine`}
          gradientUnits="userSpaceOnUse"
          cx={minX + width * 0.38}
          cy={minY + height * 0.3}
          r={Math.max(width, height) * 0.55}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={0.45 * shine} />
          <stop offset="40%" stopColor="#fff" stopOpacity={0.12 * shine} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <linearGradient
          id={`${prefix}-band`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={minY + height * 0.2}
          x2={cx}
          y2={minY + height * 0.55}
        >
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="50%" stopColor="#fff" stopOpacity={0.18 * shine} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Neutral plate so tint/multiply have a consistent base across SKUs */}
      <rect
        x={minX - 8}
        y={minY - 8}
        width={width + 16}
        height={height + 16}
        fill="#f2f2f0"
      />

      {/* Sheet texture */}
      {texStrength > 0.01 ? (
        <>
          <g opacity={texStrength} style={{ mixBlendMode: "multiply" }}>
            {sheetImage}
          </g>
          <g opacity={texStrength * 0.65} style={{ mixBlendMode: "soft-light" }}>
            {sheetImage}
          </g>
        </>
      ) : (
        <g opacity={0.85}>{sheetImage}</g>
      )}

      {/* Sheet material shine (independent of tint reflection) */}
      {shine > 0.01 ? (
        <>
          <rect
            x={minX - 8}
            y={minY - 8}
            width={width + 16}
            height={height + 16}
            fill={`url(#${prefix}-shine)`}
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
