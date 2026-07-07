import type { FrameOption } from "@/lib/luxe-data";

import type { CatalogIssue } from "../catalog-lifecycle/types";

export const UNAVAILABLE_FRAME_MARKER = "__unavailable_frame__";

export function isUnavailableFrame(frame: FrameOption): boolean {
  return frame.metadata?.catalogIssue != null || frame.metadata?.isPlaceholder === true;
}

export function unavailableIssueForFrame(frame: FrameOption): CatalogIssue | null {
  const issue = frame.metadata?.catalogIssue;
  if (issue === "deleted" || issue === "unavailable") return issue;
  return null;
}

export function createUnavailableFrame(params: {
  issue: CatalogIssue;
  savedFrameId?: string;
}): FrameOption {
  const savedId = params.savedFrameId?.trim() || UNAVAILABLE_FRAME_MARKER;
  return {
    id: savedId,
    name: "Unavailable Frame",
    description: "This frame is no longer available. Please choose another frame.",
    price: 0,
    renderViews: [],
    frameImages: [],
    lensColors: [],
    metadata: {
      catalogIssue: params.issue,
      isPlaceholder: true,
    },
  };
}
