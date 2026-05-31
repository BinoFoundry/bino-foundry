import { DEFAULT_VIEWBOX } from "../constants";
import { FRONT_LENS_PATH } from "../demo/default-vectors";
import { SvgTintGradientDef } from "../tint/SvgTintGradientDef";
import { normalizeTintRenderSpec, type NormalizedTintRenderSpec } from "../tint/lens-tint-spec";
import type { TintGradient } from "../types";
import { LayerView } from "./LayerView";

interface SvgLensLayerProps {
  zIndex: number;
  tint: TintGradient;
  gradientId?: string;
}

export function SvgLensLayer({ zIndex, tint, gradientId = "lensGradFront" }: SvgLensLayerProps) {
  const spec: NormalizedTintRenderSpec = normalizeTintRenderSpec(tint);

  return (
    <LayerView zIndex={zIndex}>
      <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[80%]" aria-hidden>
        <defs>
          <SvgTintGradientDef id={gradientId} spec={spec} />
        </defs>
        <path
          d={FRONT_LENS_PATH}
          fill={`url(#${gradientId})`}
          style={{ mixBlendMode: "soft-light", opacity: spec.opacity }}
        />
      </svg>
    </LayerView>
  );
}
