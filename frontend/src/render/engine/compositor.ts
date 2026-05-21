import { DEFAULT_FRAME_VECTOR_COLOR, LAYER_Z_INDEX } from "../constants";
import type {
  CompositorLayerSpec,
  CompositorStack,
  CompositorView,
  SunglassesCompositorConfig,
} from "../types";

function layer(
  id: string,
  type: CompositorLayerSpec["type"],
  payload: Record<string, unknown>,
  overrides?: Partial<CompositorLayerSpec>,
): CompositorLayerSpec {
  return {
    id,
    type,
    zIndex: LAYER_Z_INDEX[type],
    visible: true,
    payload,
    ...overrides,
  };
}

/**
 * Builds an ordered layer stack from config (prototype customizer.html workflow).
 */
export function buildCompositorStack(
  config: SunglassesCompositorConfig,
  view: CompositorView = "front",
): CompositorStack {
  const dynamicOnly = config.renderMode === "customiser-dynamic";
  const layers: CompositorLayerSpec[] = [];

  if (view === "side") {
    layers.push(
      layer("frame-side", "frame-vector", {
        variant: "side",
        color: DEFAULT_FRAME_VECTOR_COLOR,
      }),
    );
    return { view, layers };
  }

  const { raster } = config;
  const useRasterBase = !dynamicOnly && Boolean(raster?.frameImageUrl || raster?.lensImageUrl);

  if (!useRasterBase) {
    layers.push(layer("shadow", "shadow", { variant: "front" }, { opacity: 0.2 }));
  }

  if (raster?.lensImageUrl) {
    layers.push(
      layer("lens-image", "lens-image", {
        src: raster.lensImageUrl,
        alt: config.tint.name,
      }),
    );
  } else if (raster?.frameImageUrl && raster.useGradientOverlay) {
    layers.push(
      layer("tint-overlay", "tint-overlay", {
        top: config.tint.top,
        bottom: config.tint.bottom,
        gradient: true,
      }),
    );
  } else if (!useRasterBase || raster?.useGradientOverlay) {
    layers.push(
      layer("lens-gradient", "lens-gradient", {
        top: config.tint.top,
        bottom: config.tint.bottom,
      }),
    );
  }

  if (raster?.frameImageUrl) {
    layers.push(
      layer("frame-image", "frame-image", {
        src: raster.frameImageUrl,
        alt: config.frameLabel ?? "Frame",
      }),
    );
  }

  if (!useRasterBase) {
    layers.push(layer("highlight", "highlight", { variant: "front" }, { opacity: 0.4 }));
    layers.push(
      layer("frame-vector", "frame-vector", {
        variant: "front",
        color: DEFAULT_FRAME_VECTOR_COLOR,
      }),
    );
  } else if (!raster?.frameImageUrl && !raster?.lensImageUrl) {
    layers.push(
      layer("frame-vector", "frame-vector", {
        variant: "front",
        color: DEFAULT_FRAME_VECTOR_COLOR,
      }),
    );
  }

  return { view, layers: layers.sort((a, b) => a.zIndex - b.zIndex) };
}
