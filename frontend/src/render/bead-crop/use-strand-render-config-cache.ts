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

  const context = useMemo(
    (): StrandRenderCatalogueContext => ({
      beadTypes,
      subBeadTypes,
      beadLibraries,
      strandRenderDefaults,
    }),
    [beadTypes, subBeadTypes, beadLibraries, strandRenderDefaults],
  );

  const cache = useMemo(() => {
    return buildStrandRenderConfigCache(librariesRef.current, context);
  }, [context, version]);

  const getForBead = useMemo(
    () => (bead: BeadLibraryEntry | null | undefined) => {
      if (!bead) {
        return resolveStrandRenderConfigForBead(null, context);
      }
      // Order-snapshot beads carry a frozen profile — never use the live catalogue cache.
      if (
        (bead.metadata as { frozenStrandRenderProfile?: unknown } | undefined)
          ?.frozenStrandRenderProfile
      ) {
        return resolveStrandRenderConfigForBead(bead, context);
      }
      return cache.get(bead.id) ?? resolveStrandRenderConfigForBead(bead, context);
    },
    [cache, context],
  );

  return { context, cache, getForBead };
}
