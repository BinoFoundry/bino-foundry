import { cn } from "@/lib/utils";
import { migrateAnchors, type MaskConfig } from "@/render/mask/mask-types";

const LENS_OVERLAY: Record<string, { fill: string; stroke: string; label: string }> = {
  left: {
    fill: "rgba(217, 187, 176, 0.42)",
    stroke: "rgba(64, 66, 37, 0.75)",
    label: "Left lens",
  },
  right: {
    fill: "rgba(232, 213, 158, 0.38)",
    stroke: "rgba(64, 66, 37, 0.75)",
    label: "Right lens",
  },
};

interface FrameLensMaskOverlayProps {
  mask: MaskConfig | null | undefined;
  width: number;
  height: number;
  className?: string;
}

/** Semi-transparent left/right lens overlays for admin review before saving. */
export function FrameLensMaskOverlay({ mask, width, height, className }: FrameLensMaskOverlayProps) {
  if (!mask?.lenses?.length || width <= 0 || height <= 0) return null;

  const lenses = mask.lenses.filter((l) => migrateAnchors(l.points).length >= 3);
  if (!lenses.length) return null;

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {lenses.map((lens) => {
        const style = LENS_OVERLAY[lens.id] ?? {
          fill: "rgba(217, 187, 176, 0.35)",
          stroke: "rgba(64, 66, 37, 0.6)",
          label: lens.label,
        };
        const points = migrateAnchors(lens.points)
          .map((p) => `${p.x * width},${p.y * height}`)
          .join(" ");
        const cx =
          migrateAnchors(lens.points).reduce((sum, p) => sum + p.x, 0) /
          migrateAnchors(lens.points).length;
        const cy =
          migrateAnchors(lens.points).reduce((sum, p) => sum + p.y, 0) /
          migrateAnchors(lens.points).length;

        return (
          <g key={lens.id}>
            <polygon points={points} fill={style.fill} stroke={style.stroke} strokeWidth={2} />
            <text
              x={cx * width}
              y={cy * height}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-[10px] font-medium"
              style={{ fontSize: Math.max(10, width * 0.028) }}
            >
              {style.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
