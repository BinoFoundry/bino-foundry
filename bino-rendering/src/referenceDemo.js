import { buildFromSourceImage } from './autoLensMask.js';
import { loadImage } from './lensCompositor.js';

export const REFERENCE_DEMOS = {
  front: {
    src: '/demo/front-reference.png',
    name: 'Front reference',
    lensColor: '#3a3a3e',
    lensOpacity: 0.82,
    shadowStrength: 0,
    maskOpts: { labelBandRatio: 0.06, colorGrowDist: 62, frameProtectLum: 44 },
    effects: {
      gradientTop: 0.1,
      gradientBottom: 0.28,
      highlightY: 0.16,
      highlightHeight: 0.2,
      highlightStrength: 0.36,
    },
  },
  side: {
    src: '/demo/side-reference.png',
    name: '45° side reference',
    lensColor: '#3a3a3e',
    lensOpacity: 0.82,
    shadowStrength: 0,
    maskOpts: { labelBandRatio: 0.14, colorGrowDist: 62, lensLumMax: 238, frameProtectLum: 44 },
    effects: {
      gradientTop: 0.08,
      gradientBottom: 0.3,
      highlightY: 0.14,
      highlightHeight: 0.22,
      highlightStrength: 0.38,
    },
  },
};

export async function loadReferenceDemo(key) {
  const config = REFERENCE_DEMOS[key];
  if (!config) throw new Error(`Unknown reference demo: ${key}`);

  const source = await loadImage(config.src);
  const { maskCanvas, frameImage, backImage } = await buildFromSourceImage(
    source,
    config.maskOpts,
  );

  return {
    sourceImage: source,
    maskCanvas,
    frameImage,
    backImage,
    lensColor: config.lensColor,
    lensOpacity: config.lensOpacity,
    shadowStrength: config.shadowStrength,
    effects: { ...config.effects },
    name: config.name,
  };
}
