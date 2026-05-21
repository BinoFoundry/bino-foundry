import { buildLayersFromSource, detectLensMask } from "../../mask/auto-lens-mask";
import { loadPlateForRendering } from "../../mask/apply-mask";
import type { MaskConfig } from "../../mask/mask-types";
import { isMaskConfigValid } from "../../mask/mask-types";
import { loadImage, renderAutoRecolor } from "./lens-compositor";

export interface MaskedViewInput {
  plateUrl: string;
  width: number;
  height: number;
  maskConfig: MaskConfig | null;
  /** Auto-mask tuning when no polygon mask (side vs front). */
  autoMaskOptions?: Record<string, number>;
}

export interface LensTintRenderParams {
  lensColor: string;
  lensOpacity: number;
  effects: {
    gradientTop: number;
    gradientBottom: number;
    highlightY: number;
    highlightHeight: number;
    highlightStrength: number;
  };
  shadowStrength?: number;
  background?: string;
}

const DEFAULT_EFFECTS: LensTintRenderParams["effects"] = {
  gradientTop: 0.12,
  gradientBottom: 0.18,
  highlightY: 0.22,
  highlightHeight: 0.35,
  highlightStrength: 0.35,
};

const SIDE_AUTO_MASK: Record<string, number> = {
  labelBandRatio: 0.14,
  lensLumMax: 238,
  colorGrowDist: 4,
};

const FRONT_AUTO_MASK: Record<string, number> = {
  labelBandRatio: 0.06,
};

/**
 * Render a masked frame plate with dynamic lens tint (bino-rendering parity).
 */
export async function renderMaskedViewToCanvas(
  canvas: HTMLCanvasElement,
  view: MaskedViewInput,
  tint: LensTintRenderParams,
): Promise<void> {
  const sourceImage = await loadImage(view.plateUrl);
  let maskCanvas: HTMLCanvasElement | null = null;

  if (view.maskConfig && isMaskConfigValid(view.maskConfig)) {
    const layers = await loadPlateForRendering({
      sourceUrl: view.plateUrl,
      maskConfig: view.maskConfig,
      width: view.width,
      height: view.height,
    });
    maskCanvas = layers.maskCanvas;
    renderAutoRecolor(canvas, {
      sourceImage: layers.sourceImage,
      maskCanvas,
      lensColor: tint.lensColor,
      lensOpacity: tint.lensOpacity,
      effects: tint.effects ?? DEFAULT_EFFECTS,
      shadowStrength: tint.shadowStrength ?? 0.12,
      background: tint.background ?? "#ffffff",
      maskOnly: true,
    });
    return;
  }

  const autoOpts = view.autoMaskOptions ?? FRONT_AUTO_MASK;
  maskCanvas = detectLensMask(sourceImage, autoOpts);
  const { backCanvas, frameCanvas } = buildLayersFromSource(sourceImage, maskCanvas);

  const toImage = (c: HTMLCanvasElement) =>
    new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.src = c.toDataURL("image/png");
    });

  const [frameImage, backImage] = await Promise.all([toImage(frameCanvas), toImage(backCanvas)]);

  renderAutoRecolor(canvas, {
    sourceImage,
    maskCanvas,
    lensColor: tint.lensColor,
    lensOpacity: tint.lensOpacity,
    effects: tint.effects ?? DEFAULT_EFFECTS,
    shadowStrength: tint.shadowStrength ?? 0.12,
    background: tint.background ?? "#ffffff",
    maskOnly: false,
  });

  // Layer composite when auto path produced frame/back split
  void frameImage;
  void backImage;
}

export function autoMaskOptionsForView(view: "front" | "side"): Record<string, number> {
  return view === "side" ? SIDE_AUTO_MASK : FRONT_AUTO_MASK;
}

export function tintParamsFromGradient(
  top: string,
  bottom: string,
  opacity = 0.88,
): LensTintRenderParams {
  return {
    lensColor: top,
    lensOpacity: opacity,
    effects: DEFAULT_EFFECTS,
    shadowStrength: 0.12,
    background: "#ffffff",
  };
}
