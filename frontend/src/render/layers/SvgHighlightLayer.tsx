import { DEFAULT_VIEWBOX } from "../constants";
import { FRONT_HIGHLIGHT_PATHS } from "../demo/default-vectors";
import { LayerView } from "./LayerView";

interface SvgHighlightLayerProps {
  zIndex: number;
  opacity?: number;
}

export function SvgHighlightLayer({ zIndex, opacity = 0.4 }: SvgHighlightLayerProps) {
  return (
    <LayerView zIndex={zIndex} opacity={opacity}>
      <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[80%]" aria-hidden>
        {FRONT_HIGHLIGHT_PATHS.map((d) => (
          <path key={d} d={d} stroke="white" strokeWidth={2} strokeLinecap="round" fill="none" />
        ))}
      </svg>
    </LayerView>
  );
}
