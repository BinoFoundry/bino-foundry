import { useMemo, useRef } from "react";

import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadTypeEntry } from "@/types/beads";
import type { ResolvedStrandRenderConfig, StrandRenderProfile } from "@bino-foundry/shared/types";

import {
  buildStrandRenderConfigCache,
  resolveStrandRenderConfigForBead,
  strandRenderCacheVersion,
  type StrandRenderCatalogueContext,
} from "./strand-render-profile";

export interface StrandRenderConfigState {
  context: StrandRenderCatalogueContext;
  cache: Map<string, ResolvedStrandRenderConfig>;
  getForBead: (bead: BeadLibraryEntry | null | undefined) => ResolvedStrandRenderConfig;
}

/** Build a memoized strand render config cache — rebuilds only when catalogue data changes. */
export function useStrandRenderConfigCache(params: {
  beadTypes: BeadTypeEntry[];
  beadLibraries: BeadLibraryEntry[];
  strandRenderDefaults: StrandRenderProfile | null;
}): StrandRenderConfigState {
  const { beadTypes, beadLibraries, strandRenderDefaults } = params;
  const version = useMemo(
    () => strandRenderCacheVersion({ beadTypes, strandRenderDefaults }, beadLibraries),
    [beadTypes, strandRenderDefaults, beadLibraries],
  );
  const librariesRef = useRef(beadLibraries);
  librariesRef.current = beadLibraries;

  const cache = useMemo(() => {
    const context: StrandRenderCatalogueContext = { beadTypes, strandRenderDefaults };
    return buildStrandRenderConfigCache(librariesRef.current, context);
  }, [beadTypes, strandRenderDefaults, version]);

  const context = useMemo(
    (): StrandRenderCatalogueContext => ({ beadTypes, strandRenderDefaults }),
    [beadTypes, strandRenderDefaults],
  );

  const getForBead = useMemo(
    () => (bead: BeadLibraryEntry | null | undefined) => {
      if (!bead) {
        return resolveStrandRenderConfigForBead(null, context);
      }
      return cache.get(bead.id) ?? resolveStrandRenderConfigForBead(bead, context);
    },
    [cache, context],
  );

  return { context, cache, getForBead };
}
