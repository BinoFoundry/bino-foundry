import type { FrameOption } from "@/lib/luxe-data";

import { createUnavailableFrame } from "./unavailable-frame";

export function resolveLoadedSunglassesFrame(params: {
  savedFrameId: string;
  catalogIssue?: "deleted" | "unavailable" | null;
  allFrames: FrameOption[];
}): {
  frameId: string;
  frame: FrameOption;
  hasCatalogIssue: boolean;
} {
  const { savedFrameId, catalogIssue, allFrames } = params;
  const match = allFrames.find((f) => f.id === savedFrameId);

  if (catalogIssue === "deleted" || (!match && savedFrameId)) {
    return {
      frameId: savedFrameId,
      frame: createUnavailableFrame({ savedFrameId, issue: "deleted" }),
      hasCatalogIssue: true,
    };
  }

  if (match) {
    return {
      frameId: match.id,
      frame: match,
      hasCatalogIssue: catalogIssue === "unavailable",
    };
  }

  const fallback = allFrames[0];
  if (fallback) {
    return { frameId: fallback.id, frame: fallback, hasCatalogIssue: false };
  }

  const placeholder = createUnavailableFrame({ savedFrameId, issue: "deleted" });
  return { frameId: savedFrameId, frame: placeholder, hasCatalogIssue: true };
}
