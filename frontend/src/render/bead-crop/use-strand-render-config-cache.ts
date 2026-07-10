import { useMemo, useRef } from "react";

import type { BeadLibraryEntry, BeadTypeEntry, SubBeadTypeEntry } from "@/types/beads";
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
  subBeadTypes: SubBeadTypeEntry[];
  beadLibraries: BeadLibraryEntry[];
  strandRenderDefaults: StrandRenderProfile | null;
}): StrandRenderConfigState {
  const { beadTypes, subBeadTypes, beadLibraries, strandRenderDefaults } = params;
  const version = useMemo(
    () => strandRenderCacheVersion({ beadTypes, subBeadTypes, strandRenderDefaults }, beadLibraries),
    [beadTypes, subBeadTypes, strandRenderDefaults, beadLibraries],
  );
  const librariesRef = useRef(beadLibraries);
  librariesRef.current = beadLibraries;

  const cache = useMemo(() => {
    const context: StrandRenderCatalogueContext = { beadTypes, subBeadTypes, strandRenderDefaults };
    return buildStrandRenderConfigCache(librariesRef.current, context);
  }, [beadTypes, subBeadTypes, strandRenderDefaults, version]);

  const context = useMemo(
    (): StrandRenderCatalogueContext => ({ beadTypes, subBeadTypes, strandRenderDefaults }),
    [beadTypes, subBeadTypes, strandRenderDefaults],
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
