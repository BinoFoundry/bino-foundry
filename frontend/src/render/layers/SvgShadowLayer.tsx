import { DEFAULT_VIEWBOX } from "../constants";
import { FRONT_SHADOW_PATH } from "../demo/default-vectors";
import { LayerView } from "./LayerView";

interface SvgShadowLayerProps {
  zIndex: number;
  opacity?: number;
}

export function SvgShadowLayer({ zIndex, opacity = 0.2 }: SvgShadowLayerProps) {
  return (
    <LayerView zIndex={zIndex} opacity={opacity} className="blur-xl translate-y-8 scale-90">
      <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[80%]" aria-hidden>
        <path d={FRONT_SHADOW_PATH} stroke="black" strokeWidth={15} fill="none" />
      </svg>
    </LayerView>
  );
}
