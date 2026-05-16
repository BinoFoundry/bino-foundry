import { DEFAULT_VIEWBOX } from "../constants";
import { FRONT_LENS_PATH } from "../demo/default-vectors";
import { LayerView } from "./LayerView";

interface SvgLensLayerProps {
  zIndex: number;
  top: string;
  bottom: string;
  gradientId?: string;
}

export function SvgLensLayer({ zIndex, top, bottom, gradientId = "lensGradFront" }: SvgLensLayerProps) {
  return (
    <LayerView zIndex={zIndex}>
      <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[80%]" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={top} stopOpacity={1} />
            <stop offset="100%" stopColor={bottom} stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <path d={FRONT_LENS_PATH} fill={`url(#${gradientId})`} />
      </svg>
    </LayerView>
  );
}
