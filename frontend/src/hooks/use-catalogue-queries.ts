import { useQuery } from "@tanstack/react-query";

import { beadsApi } from "@/services/api/beads";
import { catalogueApi } from "@/services/api";
import { catalogueKeys } from "@/state/catalogue/keys";

export function useBeadLibrariesQuery() {
  return useQuery({
    queryKey: catalogueKeys.beadLibraries(),
    queryFn: () => beadsApi.listLibraries(),
    staleTime: 60_000,
  });
}

export function useBeadTypesQuery() {
  return useQuery({
    queryKey: catalogueKeys.beadTypes(),
    queryFn: () => beadsApi.listTypes(),
    staleTime: 60_000,
  });
}

export function useFramesQuery() {
  return useQuery({
    queryKey: catalogueKeys.frames(),
    queryFn: () => catalogueApi.listFrames(),
    staleTime: 60_000,
  });
}
