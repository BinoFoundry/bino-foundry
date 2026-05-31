export const LENS_TINT_CATEGORIES = ["classic", "gradient"] as const;
export type LensTintCategory = (typeof LENS_TINT_CATEGORIES)[number];

export const GRADIENT_DIRECTIONS = [
  "top-to-bottom",
  "bottom-to-top",
  "left-to-right",
  "right-to-left",
  "custom",
] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];

/** Per-tint visual settings stored in `sunglasses_lens_tints` and passed to the compositor. */
export interface LensTintRenderFields {
  category: LensTintCategory;
  gradientTop: string;
  gradientBottom: string;
  /** 0–1 overlay strength on the lens (higher = stronger tint). */
  opacity: number;
  gradientDirection: GradientDirection;
  /** Degrees when `gradientDirection` is `custom` (0 = left→right, 90 = top→bottom). */
  gradientAngle: number;
  /** Mid-transition position along the gradient axis (0–100). */
  gradientMidPosition: number;
  /** 0 = soft blend, 1 = sharper transition between top and bottom colors. */
  gradientIntensity: number;
}

export const DEFAULT_LENS_TINT_RENDER: LensTintRenderFields = {
  category: "gradient",
  gradientTop: "#4a5568",
  gradientBottom: "#2d3748",
  opacity: 0.58,
  gradientDirection: "top-to-bottom",
  gradientAngle: 180,
  gradientMidPosition: 50,
  gradientIntensity: 0.55,
};

export const DEFAULT_CLASSIC_LENS_TINT_RENDER: LensTintRenderFields = {
  ...DEFAULT_LENS_TINT_RENDER,
  category: "classic",
  gradientBottom: DEFAULT_LENS_TINT_RENDER.gradientTop,
  opacity: 0.52,
};
