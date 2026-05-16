import { DEFAULT_VIEWBOX } from "../constants";
import { FRONT_FRAME_PATHS, SIDE_FRAME_PATHS } from "../demo/default-vectors";
import { LayerView } from "./LayerView";

interface SvgFrameLayerProps {
  zIndex: number;
  color: string;
  variant?: "front" | "side";
}

export function SvgFrameLayer({ zIndex, color, variant = "front" }: SvgFrameLayerProps) {
  if (variant === "side") {
    const h = SIDE_FRAME_PATHS.hinge;
    return (
      <LayerView zIndex={zIndex}>
        <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[70%]" aria-hidden>
          <path
            d={SIDE_FRAME_PATHS.profile}
            stroke={color}
            strokeWidth={12}
            fill="none"
            strokeLinecap="round"
          />
          <rect x={h.x} y={h.y} width={h.width} height={h.height} rx={h.rx} fill={color} />
        </svg>
      </LayerView>
    );
  }

  return (
    <LayerView zIndex={zIndex}>
      <svg viewBox={DEFAULT_VIEWBOX} className="h-auto w-[80%]" aria-hidden>
        <path
          d={FRONT_FRAME_PATHS.main}
          stroke={color}
          strokeWidth={12}
          fill="none"
          strokeLinejoin="round"
        />
        <path d={FRONT_FRAME_PATHS.bridge} stroke={color} strokeWidth={6} fill="none" />
        <path d={FRONT_FRAME_PATHS.temples} stroke={color} strokeWidth={10} strokeLinecap="round" />
      </svg>
    </LayerView>
  );
}
