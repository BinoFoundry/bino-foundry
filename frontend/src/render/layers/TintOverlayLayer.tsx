import { buildCssTintGradient } from "../tint/tint-engine";
import type { TintGradient } from "../types";
import { LayerView } from "./LayerView";

interface TintOverlayLayerProps {
  zIndex: number;
  tint: Pick<TintGradient, "top" | "bottom">;
  opacity?: number;
}

/** CSS gradient tint for raster frame plates (prototype `updateLens` concept on photos). */
export function TintOverlayLayer({ zIndex, tint, opacity = 0.55 }: TintOverlayLayerProps) {
  return (
    <LayerView zIndex={zIndex}>
      <div
        className="absolute inset-0"
        style={{
          background: buildCssTintGradient({ name: "", ...tint }, true),
          mixBlendMode: "multiply",
          opacity,
        }}
      />
    </LayerView>
  );
}
