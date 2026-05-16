import type { CompositorLayerSpec } from "../types";
import { RasterImageLayer } from "./RasterImageLayer";
import { SvgFrameLayer } from "./SvgFrameLayer";
import { SvgHighlightLayer } from "./SvgHighlightLayer";
import { SvgLensLayer } from "./SvgLensLayer";
import { SvgShadowLayer } from "./SvgShadowLayer";
import { TintOverlayLayer } from "./TintOverlayLayer";

interface LayerStackProps {
  layers: CompositorLayerSpec[];
  /** Disambiguate SVG gradient ids when multiple compositors mount */
  instanceId?: string;
}

export function LayerStack({ layers, instanceId = "cmp" }: LayerStackProps) {
  return (
    <>
      {layers.map((spec) => {
        if (spec.visible === false) return null;

        switch (spec.type) {
          case "shadow":
            return <SvgShadowLayer key={spec.id} zIndex={spec.zIndex} opacity={spec.opacity} />;

          case "lens-gradient": {
            const top = String(spec.payload.top ?? "#4a5568");
            const bottom = String(spec.payload.bottom ?? "#2d3748");
            return (
              <SvgLensLayer
                key={spec.id}
                zIndex={spec.zIndex}
                top={top}
                bottom={bottom}
                gradientId={`${instanceId}-lens`}
              />
            );
          }

          case "lens-image":
            return (
              <RasterImageLayer
                key={spec.id}
                zIndex={spec.zIndex}
                src={String(spec.payload.src)}
                alt={String(spec.payload.alt ?? "Lens")}
              />
            );

          case "tint-overlay":
            return (
              <TintOverlayLayer
                key={spec.id}
                zIndex={spec.zIndex}
                tint={{
                  top: String(spec.payload.top),
                  bottom: String(spec.payload.bottom),
                }}
                opacity={spec.opacity}
              />
            );

          case "highlight":
            return <SvgHighlightLayer key={spec.id} zIndex={spec.zIndex} opacity={spec.opacity} />;

          case "frame-vector":
            return (
              <SvgFrameLayer
                key={spec.id}
                zIndex={spec.zIndex}
                color={String(spec.payload.color ?? "#1a1a1a")}
                variant={spec.payload.variant === "side" ? "side" : "front"}
              />
            );

          case "frame-image":
            return (
              <RasterImageLayer
                key={spec.id}
                zIndex={spec.zIndex}
                src={String(spec.payload.src)}
                alt={String(spec.payload.alt ?? "Frame")}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}
