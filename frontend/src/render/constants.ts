import { brandColors } from "@/styles/design-tokens";

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

/** Default vector frame fill when no per-SKU colour is configured. */
export const DEFAULT_FRAME_VECTOR_COLOR = brandColors.olive;

/** UI canvas surface — warm neutral (#F2ECE8); see `--surface-canvas` in index.css. */
export const UI_CANVAS_BACKGROUND = brandColors.canvasWarm;

/** Pure white for mask rasterization and lens compositing only — not page/canvas UI. */
export const RENDER_CANVAS_BACKGROUND = "#FFFFFF";

export const COMPOSITOR_TRANSITION_MS = 400;
