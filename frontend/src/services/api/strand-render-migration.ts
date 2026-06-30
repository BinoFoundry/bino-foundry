import { apiRequest } from "./client";

export interface StrandRenderMigrationStats {
  typesInitialized: number;
  typesSkipped: number;
  librariesCleaned: number;
  librariesSkipped: number;
}

export const strandRenderMigrationApi = {
  initializeMissingTypes(): Promise<Pick<StrandRenderMigrationStats, "typesInitialized" | "typesSkipped">> {
    return apiRequest("/strand-render-migration/initialize-missing-types", { method: "POST" });
  },

  runFullMigration(): Promise<StrandRenderMigrationStats> {
    return apiRequest("/strand-render-migration/run", { method: "POST" });
  },

  cleanupLibraryOverrides(): Promise<
    Pick<StrandRenderMigrationStats, "librariesCleaned" | "librariesSkipped">
  > {
    return apiRequest("/strand-render-migration/cleanup-library-overrides", { method: "POST" });
  },

  resetLibrariesToType(libraryIds?: string[]): Promise<{ updated: number }> {
    return apiRequest("/strand-render-migration/reset-libraries-to-type", {
      method: "POST",
      body: { libraryIds },
    });
  },

  resetTypeToSystem(typeId: string): Promise<unknown> {
    return apiRequest(`/strand-render-migration/types/${encodeURIComponent(typeId)}/reset-to-system`, {
      method: "POST",
    });
  },

  applyTypeToLibraries(typeId: string): Promise<{ updated: number }> {
    return apiRequest(
      `/strand-render-migration/types/${encodeURIComponent(typeId)}/apply-to-libraries`,
      { method: "POST" },
    );
  },
};
