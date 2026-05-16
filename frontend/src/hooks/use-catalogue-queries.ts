import { useQuery } from "@tanstack/react-query";

import { catalogueApi } from "@/services/api";
import { catalogueKeys } from "@/state/catalogue/keys";

export function useCrystalsQuery() {
  return useQuery({
    queryKey: catalogueKeys.crystals(),
    queryFn: () => catalogueApi.listCrystals(),
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

export function useTypesQuery() {
  return useQuery({
    queryKey: catalogueKeys.types(),
    queryFn: () => catalogueApi.listTypes(),
    staleTime: 60_000,
  });
}
