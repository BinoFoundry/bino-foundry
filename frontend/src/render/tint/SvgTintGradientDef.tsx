import { buildSvgGradientStops, getLinearGradientVector, type NormalizedTintRenderSpec } from "./lens-tint-spec";

export function SvgTintGradientDef({
  id,
  spec,
}: {
  id: string;
  spec: NormalizedTintRenderSpec;
}) {
  const vector = getLinearGradientVector(spec);
  const stops = buildSvgGradientStops(spec);

  return (
    <linearGradient
      id={id}
      x1={vector.x1}
      y1={vector.y1}
      x2={vector.x2}
      y2={vector.y2}
      gradientUnits={vector.gradientUnits}
      gradientTransform={vector.gradientTransform}
    >
      {stops.map((stop, index) => (
        <stop
          key={`${stop.offset}-${index}`}
          offset={stop.offset}
          stopColor={stop.stopColor}
          stopOpacity={stop.stopOpacity}
        />
      ))}
    </linearGradient>
  );
}
