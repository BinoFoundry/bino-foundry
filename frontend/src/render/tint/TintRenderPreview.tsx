import { SvgTintGradientDef } from "./SvgTintGradientDef";
import { normalizeTintRenderSpec } from "./lens-tint-spec";
import type { LensTintEntry } from "@/types/sunglasses-catalog";

/** SVG swatch using the same gradient definition as the lens compositor. */
export function TintRenderPreview({
  entry,
  className = "h-20 w-full rounded-lg border border-border shadow-inner",
}: {
  entry: Pick<
    LensTintEntry,
    | "name"
    | "category"
    | "gradientTop"
    | "gradientBottom"
    | "opacity"
    | "gradientDirection"
    | "gradientAngle"
    | "gradientMidPosition"
    | "gradientIntensity"
  >;
  className?: string;
}) {
  const spec = normalizeTintRenderSpec({
    name: entry.name || "Preview",
    top: entry.gradientTop || "#4a5568",
    bottom: entry.gradientBottom || "#2d3748",
    category: entry.category,
    opacity: entry.opacity,
    gradientDirection: entry.gradientDirection,
    gradientAngle: entry.gradientAngle,
    gradientMidPosition: entry.gradientMidPosition,
    gradientIntensity: entry.gradientIntensity,
  });
  const gradId = "admin-tint-preview-grad";

  return (
    <svg viewBox="0 0 200 80" className={className} role="img" aria-label="Tint render preview">
      <defs>
        <SvgTintGradientDef id={gradId} spec={spec} />
      </defs>
      <rect x={0} y={0} width={200} height={80} fill="#e2e8f0" />
      <rect
        x={24}
        y={12}
        width={152}
        height={56}
        rx={28}
        fill={`url(#${gradId})`}
        style={{ mixBlendMode: "soft-light", opacity: spec.opacity }}
      />
      <rect
        x={24}
        y={12}
        width={152}
        height={56}
        rx={28}
        fill={`url(#${gradId})`}
        style={{ mixBlendMode: "screen", opacity: spec.opacity * 0.35 }}
      />
    </svg>
  );
}
