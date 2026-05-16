import { useEffect, useMemo } from "react";

import { buildCompositorConfigFromCatalogue, type CatalogueLensColor } from "../adapters/catalogue-adapter";
import type { FrameOption } from "@/lib/luxe-data";
import { useRenderFacade } from "../RenderProvider";
import { buildCompositorStack } from "../engine/compositor";
import type { CompositorView, SunglassesCompositorConfig } from "../types";

/**
 * Catalogue → compositor config + optional asset preload.
 */
export function useCompositor(
  frame: FrameOption,
  lens: CatalogueLensColor,
  view: CompositorView = "front",
  overrides?: Partial<SunglassesCompositorConfig>,
) {
  const facade = useRenderFacade();

  const config = useMemo(
    () => buildCompositorConfigFromCatalogue(frame, lens, overrides),
    [frame, lens, overrides],
  );

  const stack = useMemo(() => buildCompositorStack(config, view), [config, view]);

  useEffect(() => {
    const urls = [config.raster?.frameImageUrl, config.raster?.lensImageUrl].filter(
      (u): u is string => Boolean(u),
    );
    if (urls.length) {
      void facade.getAssetLoader().preloadMany(urls);
    }
  }, [config.raster?.frameImageUrl, config.raster?.lensImageUrl, facade]);

  return { config, stack };
}
