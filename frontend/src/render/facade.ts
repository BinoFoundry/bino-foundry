import { AssetLoader } from "./assets/asset-loader";
import type { RenderComposition, RenderFacade } from "./types";

export function createRenderEngineFacade(): RenderFacade {
  const assetLoader = new AssetLoader();

  return {
    init() {
      /* ready for compositor mounts */
    },
    getAssetLoader() {
      return assetLoader;
    },
    async compose(_composition: RenderComposition) {
      /* Milestone 2+: OffscreenCanvas export */
    },
  };
}

/** @deprecated Use `createRenderEngineFacade` */
export const createPlaceholderRenderFacade = createRenderEngineFacade;
