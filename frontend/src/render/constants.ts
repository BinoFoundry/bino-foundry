import type { CompositorLayerType } from "./types";

/** Paint order for SVG / DOM layers (matches prototype customizer.html). */
export const LAYER_Z_INDEX: Record<CompositorLayerType, number> = {
  shadow: 10,
  "lens-gradient": 20,
  "lens-image": 22,
  "tint-overlay": 25,
  highlight: 30,
  "frame-image": 40,
  "frame-vector": 50,
};

export const DEFAULT_VIEWBOX = "0 0 400 200";

export const COMPOSITOR_TRANSITION_MS = 400;
