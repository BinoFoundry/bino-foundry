import type { BeadSlotSizingResult } from "./strand-bead-sizing";
import { isStrandBeadGeometryOverlayEnabled } from "./crop-geometry-audit";

interface StrandBeadFootprintDebugProps {
  sizing: BeadSlotSizingResult;
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "?";
  return n.toFixed(digits);
}

function boundsBox(
  bounds: { left: number; top: number; width: number; height: number },
  className: string,
  title: string,
) {
  return (
    <div
      className={className}
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }}
      title={title}
    />
  );
}

/** Dev overlay — sizing + crop geometry. `bino-strand-bead-debug=1` stats, `=2` full overlay. */
export function StrandBeadFootprintDebug({ sizing }: StrandBeadFootprintDebugProps) {
  const geo = sizing.cropGeometry;
  const geometryOverlay = isStrandBeadGeometryOverlayEnabled();
  const w = sizing.dimensions.width;
  const h = sizing.dimensions.height;

  const polygonPoints = geo.cropPolygonPointsPx;
  const polygonSvg =
    geometryOverlay && polygonPoints && polygonPoints.length >= 3 ? (
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={w}
        height={h}
        aria-hidden
      >
        <polygon
          points={polygonPoints.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="rgba(56,189,248,0.12)"
          stroke="rgb(56,189,248)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      </svg>
    ) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50" aria-hidden>
      {boundsBox(
        geo.layoutBoundsPx,
        "absolute border-2 border-dashed border-red-500/95",
        "1. Layout / wrapper boundary",
      )}

      {boundsBox(
        geo.imageBoundsPx,
        "absolute border-2 border-dashed border-amber-400/95",
        "2. Image boundary",
      )}

      {geo.clipPathBoundsPx
        ? boundsBox(
            geo.clipPathBoundsPx,
            "absolute border-2 border-dotted border-violet-400/95",
            "3. Clip-path polygon bbox",
          )
        : null}

      {geo.exportVisibleBoundsPx
        ? boundsBox(
            geo.exportVisibleBoundsPx,
            "absolute border-2 border-green-500/95",
            "Visible silhouette bounds",
          )
        : geo.visibleBoundsPx
          ? boundsBox(
              geo.visibleBoundsPx,
              "absolute border-2 border-green-500/95",
              "Visible mask bounds",
            )
          : null}

      {polygonSvg}

      <div className="absolute -bottom-1 left-0 right-0 translate-y-full px-0.5">
        <p className="max-w-[190px] whitespace-normal rounded bg-black/85 px-1 py-0.5 font-mono text-[7px] leading-tight text-white">
          <span className="block text-amber-200">MM: {sizing.configuredSizeMm}</span>
          <span className="block text-white/90">Target Ø: {fmt(sizing.targetDiameterPx)} px</span>
          <span className="block text-lime-200">
            Visible Ø: {fmt(sizing.actualVisibleDiameterPx)} px
          </span>
          <span className="block text-violet-200">
            Clip bbox: {fmt(geo.clipPathBoundsWidthPx)} × {fmt(geo.clipPathBoundsHeightPx)} px
          </span>
          <span className="block text-sky-200">
            Clip fill: {fmt(geo.clipPathBBoxFillPct, 1)}% · poly{" "}
            {fmt(geo.cropPolygonAreaPct, 1)}%
          </span>
          <span className="block text-green-200">
            Visible poly: {fmt(geo.visiblePolygonAreaPct, 1)}%
          </span>
          {geo.anchorVsVisibleBBoxDeltaPct != null ? (
            <span className="block text-orange-200">
              Anchor vs visible Δ: {fmt(geo.anchorVsVisibleBBoxDeltaPct, 1)}%
            </span>
          ) : null}
          <span className="block text-fuchsia-200">
            Occupancy: {fmt(sizing.occupancyRatio * 100, 1)}% · img scale{" "}
            {fmt(sizing.imageRenderScale, 3)}
          </span>
          <span className="block text-white/80">
            Src: {geo.renderImageSource} · {geo.metricsSource ?? sizing.sizingPath}
          </span>
          <span className="block text-white/70">
            {sizing.usesClipPath ? "clip-path on" : "no clip"} · pts {geo.cropPointCount}
          </span>
          {geometryOverlay ? (
            <span className="block text-white/60">geometry overlay on</span>
          ) : (
            <span className="block text-white/50">set debug=2 for polygon</span>
          )}
        </p>
      </div>
    </div>
  );
}
