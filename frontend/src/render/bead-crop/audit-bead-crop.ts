import { getBeadCropPoints, type BeadCropConfig, type BeadCropMetricsSource } from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import { hasDistinctProcessedAsset } from "./apply-crop";
import { resolveBeadPhysicalMetricsAudit } from "./crop-visual-bounds";
import { resolveBeadCropConfig } from "./resolve-bead-crop-config";
import { getBeadSlotDimensions, mmToBasePx } from "./strand-bead";

export type BeadCropAuditIssue =
  | "missing-metrics"
  | "anchor-estimate"
  | "rect-estimate"
  | "no-processed-asset"
  | "missing-delivery-variants"
  | "missing-processed-dimensions";

export interface BeadCropSizingAudit {
  beadId: string;
  beadName: string;
  metricsSource: BeadCropMetricsSource | "missing";
  visibleWidthPx: number | null;
  visibleHeightPx: number | null;
  referenceDiameterPx: number | null;
  processedWidthPx: number | null;
  processedHeightPx: number | null;
  hasProcessedAsset: boolean;
  hasDeliveryUrls: boolean;
  issues: BeadCropAuditIssue[];
  /** Rendering issue likely from metadata — re-save crop in admin. */
  likelyNeedsRecrop: boolean;
  /** Rendering issue likely from code — not asset recrop. */
  likelyRenderingIssue: boolean;
}

export function auditBeadCropSizing(bead: BeadLibraryEntry): BeadCropSizingAudit {
  const resolution = resolveBeadPhysicalMetricsAudit(bead);
  const config = resolveBeadCropConfig(bead);
  const metrics = resolution?.metrics ?? null;
  const hasProcessed = hasDistinctProcessedAsset(bead);
  const delivery =
    config?.version === 2 && config.deliveryUrls
      ? Boolean(config.deliveryUrls.avif || config.deliveryUrls.webp || config.deliveryUrls.png)
      : false;

  const issues: BeadCropAuditIssue[] = [];

  if (!resolution) issues.push("missing-metrics");
  if (resolution?.source === "anchorEstimate") issues.push("anchor-estimate");
  if (resolution?.source === "cropRect") issues.push("rect-estimate");
  if (!hasProcessed && getBeadCropPoints(config).length >= 3) issues.push("no-processed-asset");
  if (hasProcessed && !delivery) issues.push("missing-delivery-variants");
  if (hasProcessed && metrics && (!metrics.processedWidthPx || !metrics.processedHeightPx)) {
    issues.push("missing-processed-dimensions");
  }

  const likelyNeedsRecrop = Boolean(
    issues.includes("missing-metrics") &&
      !hasProcessed &&
      getBeadCropPoints(config).length < 3,
  );

  const likelyRenderingIssue = issues.includes("anchor-estimate") && hasProcessed;

  return {
    beadId: bead.id,
    beadName: bead.name,
    metricsSource: resolution?.source ?? "missing",
    visibleWidthPx: metrics?.visibleWidthPx ?? null,
    visibleHeightPx: metrics?.visibleHeightPx ?? null,
    referenceDiameterPx: metrics?.referenceDiameterPx ?? null,
    processedWidthPx: metrics?.processedWidthPx ?? null,
    processedHeightPx: metrics?.processedHeightPx ?? null,
    hasProcessedAsset: hasProcessed,
    hasDeliveryUrls: delivery,
    issues,
    likelyNeedsRecrop,
    likelyRenderingIssue,
  };
}

export function auditBeadLibrarySizing(beads: BeadLibraryEntry[]): {
  audits: BeadCropSizingAudit[];
  needsRecrop: BeadCropSizingAudit[];
  ok: BeadCropSizingAudit[];
} {
  const audits = beads.map(auditBeadCropSizing);
  return {
    audits,
    needsRecrop: audits.filter((a) => a.likelyNeedsRecrop),
    ok: audits.filter((a) => !a.likelyNeedsRecrop && a.referenceDiameterPx),
  };
}

/** Compare two beads at the same mm — should yield identical max footprint when metrics are sound. */
export function compareBeadRenderDiameterAtMm(
  beadA: BeadLibraryEntry,
  beadB: BeadLibraryEntry,
  sizeMm: number,
  scaleFactor = 1,
): {
  diameterA: number | null;
  diameterB: number | null;
  match: boolean;
  auditA: BeadCropSizingAudit;
  auditB: BeadCropSizingAudit;
} {
  const mockPlaced = (bead: BeadLibraryEntry) => ({
    position: 0,
    size: { offerKey: "k", sizeMm, label: `${sizeMm} mm`, unitPrice: 1 },
    bead,
  });
  const dimA = getBeadSlotDimensions(mockPlaced(beadA), sizeMm, scaleFactor);
  const dimB = getBeadSlotDimensions(mockPlaced(beadB), sizeMm, scaleFactor);
  const diameterA = Math.max(dimA.width, dimA.height);
  const diameterB = Math.max(dimB.width, dimB.height);
  const target = mmToBasePx(sizeMm, scaleFactor);
  const auditA = auditBeadCropSizing(beadA);
  const auditB = auditBeadCropSizing(beadB);

  return {
    diameterA,
    diameterB,
    match: Math.abs(diameterA - diameterB) < 0.5,
    auditA,
    auditB,
  };
}
