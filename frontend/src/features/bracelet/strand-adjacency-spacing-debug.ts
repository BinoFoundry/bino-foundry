import type { BeadLibraryEntry, BeadTypeEntry } from "@/types/beads";
import {
  contactWidthStoredToTuningDelta,
  effectiveStrandContactWidth,
  type ResolvedStrandRenderConfig,
  type StrandRenderProfile,
} from "@bino-foundry/shared/types";
import { getBeadStrandTangentContactPx, type BeadSlotSizingResult } from "@/render/bead-crop";
import type { StrandRenderCatalogueContext } from "@/render/bead-crop/strand-render-profile";

import { adjacentIndexAngleDeltaRad } from "./strand-elastic-layout";

export interface StrandAdjacencySpacingEntry {
  fromIndex: number;
  toIndex: number;
  radiusA: number;
  radiusB: number;
  contactWidthA: number;
  contactAdjustmentA: number;
  contactWidthB: number;
  contactAdjustmentB: number;
  contactWidthSourceA: string;
  contactAdjustmentSourceA: string;
  naturalTouchDistancePx: number;
  calculatedDistancePx: number;
  spanMultiplierA: number;
  spanMultiplierB: number;
  contactArcA: number;
  contactArcB: number;
  junctionOverlapPx: number;
  centreToCentreArcPx: number;
  finalDistancePx: number;
  beadAX: number;
  beadAY: number;
  beadBX: number;
  beadBY: number;
}

export interface StrandAdjacencySpacingDebugInput {
  sizingResults: Pick<
    BeadSlotSizingResult,
    | "dimensions"
    | "visibleContentWidthPx"
    | "visibleContentDiameterPx"
    | "actualVisibleDiameterPx"
    | "isRoundVisualBead"
    | "exportFillRatio"
  >[];
  profiles: ResolvedStrandRenderConfig[];
  contactArcPx: number[];
  leadingOverlapPx: number[];
  trailingOverlapPx: number[];
  angles: number[];
  radiusPx: number;
  beadPositions: Array<{ x: number; y: number }>;
}

export interface StrandSpacingForceOverrides {
  contactWidth?: number;
  contactOffset?: number;
}

function readLocalStorageNumber(key: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Dev-only render overrides — set via localStorage, not admin. */
export function readStrandSpacingForceOverrides(): StrandSpacingForceOverrides | null {
  const contactWidth = readLocalStorageNumber("strand-spacing-force-contact-width");
  const contactOffset = readLocalStorageNumber("strand-spacing-force-contact-offset");
  if (contactWidth === undefined && contactOffset === undefined) return null;
  return { contactWidth, contactOffset };
}

export function applyStrandSpacingForceOverrides(
  profiles: ResolvedStrandRenderConfig[],
): ResolvedStrandRenderConfig[] {
  const force = readStrandSpacingForceOverrides();
  if (!force) return profiles;
  return profiles.map((profile) => ({
    ...profile,
    ...(force.contactWidth !== undefined ? { contactWidth: force.contactWidth } : {}),
    ...(force.contactOffset !== undefined ? { contactOffset: force.contactOffset } : {}),
  }));
}

export function isStrandSpacingDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("strand-spacing-debug") === "1";
  } catch {
    return false;
  }
}

function formatSpacingValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : String(value);
}

function beadTypeContactValues(
  bead: BeadLibraryEntry | null | undefined,
  catalogue: StrandRenderCatalogueContext | undefined,
): { contactWidth?: number; contactOffset?: number } {
  if (!bead || !catalogue?.beadTypes?.length) return {};
  const type =
    catalogue.beadTypes.find((t) => t.id === bead.beadTypeId) ??
    catalogue.beadTypes.find((t) => t.slug === bead.beadTypeSlug);
  const strandRender = (type?.metadata as { strandRender?: StrandRenderProfile } | undefined)?.strandRender;
  if (!strandRender || typeof strandRender !== "object") return {};
  const partial = strandRender as Partial<StrandRenderProfile>;
  return {
    contactWidth: typeof partial.contactWidth === "number" ? partial.contactWidth : undefined,
    contactOffset: typeof partial.contactOffset === "number" ? partial.contactOffset : undefined,
  };
}

/** Trace catalogue → resolved profile for the first placed bead (data-flow sanity check). */
export function logStrandSpacingDataFlow(params: {
  bead: BeadLibraryEntry | null | undefined;
  catalogue: StrandRenderCatalogueContext | undefined;
  resolved: ResolvedStrandRenderConfig;
}): void {
  const { bead, catalogue, resolved } = params;
  const typeValues = beadTypeContactValues(bead, catalogue);
  const libraryOverride = (bead?.metadata as { strandRenderOverride?: Partial<StrandRenderProfile> } | undefined)
    ?.strandRenderOverride;

  console.group("[strand-spacing] data flow (first bead)");
  console.log("beadTypeId", bead?.beadTypeId ?? "(missing)");
  console.log("beadTypeSlug", bead?.beadTypeSlug ?? "(missing)");
  console.log("catalogue.beadType strandRender", typeValues);
  console.log("library.strandRenderOverride", libraryOverride ?? null);
  console.log("library.useTypeStrandDefaults", (bead?.metadata as { useTypeStrandDefaults?: boolean } | undefined)?.useTypeStrandDefaults);
  console.log("resolved.contactWidth", resolved.contactWidth, "source", resolved.provenance.contactWidth);
  console.log("resolved.contactOffset", resolved.contactOffset, "source", resolved.provenance.contactOffset);
  console.log("resolved.visualScale", resolved.visualScale, "source", resolved.provenance.visualScale);
  console.log("resolved.hangOffset", resolved.hangOffset, "source", resolved.provenance.hangOffset);
  console.log("resolved.orientationMode", resolved.orientationMode, "source", resolved.provenance.orientationMode);
  console.log("resolved spanMultiplier", effectiveStrandContactWidth(resolved));
  console.groupEnd();
}

/** Per adjacent pair along the closed strand — values used immediately before shell placement. */
export function computeStrandAdjacencySpacingDebug(
  input: StrandAdjacencySpacingDebugInput,
): StrandAdjacencySpacingEntry[] {
  const {
    sizingResults,
    profiles,
    contactArcPx,
    leadingOverlapPx,
    trailingOverlapPx,
    angles,
    radiusPx,
    beadPositions,
  } = input;
  const n = sizingResults.length;
  if (n < 2) return [];

  const entries: StrandAdjacencySpacingEntry[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const naturalA = getBeadStrandTangentContactPx(sizingResults[i]!);
    const naturalB = getBeadStrandTangentContactPx(sizingResults[j]!);
    const radiusA = naturalA / 2;
    const radiusB = naturalB / 2;
    const profileA = profiles[i]!;
    const profileB = profiles[j]!;
    const spanMultiplierA = effectiveStrandContactWidth(profileA);
    const spanMultiplierB = effectiveStrandContactWidth(profileB);
    const naturalTouchDistancePx = radiusA + radiusB;
    const calculatedDistancePx =
      (contactArcPx[i]! + contactArcPx[j]!) / 2 - trailingOverlapPx[i]! - leadingOverlapPx[j]!;
    const junctionOverlapPx = trailingOverlapPx[i]! + leadingOverlapPx[j]!;
    const centreToCentreArcPx = adjacentIndexAngleDeltaRad(angles, i) * radiusPx;
    const posA = beadPositions[i]!;
    const posB = beadPositions[j]!;

    entries.push({
      fromIndex: i,
      toIndex: j,
      radiusA,
      radiusB,
      contactWidthA: profileA.contactWidth,
      contactAdjustmentA: profileA.contactOffset,
      contactWidthB: profileB.contactWidth,
      contactAdjustmentB: profileB.contactOffset,
      contactWidthSourceA: profileA.provenance.contactWidth,
      contactAdjustmentSourceA: profileA.provenance.contactOffset,
      naturalTouchDistancePx,
      calculatedDistancePx,
      spanMultiplierA,
      spanMultiplierB,
      contactArcA: contactArcPx[i]!,
      contactArcB: contactArcPx[j]!,
      junctionOverlapPx,
      centreToCentreArcPx,
      finalDistancePx: centreToCentreArcPx,
      beadAX: posA.x,
      beadAY: posA.y,
      beadBX: posB.x,
      beadBY: posB.y,
    });
  }
  return entries;
}

/** Console log render-time spacing — not DB values. */
export function logStrandAdjacencySpacing(entries: StrandAdjacencySpacingEntry[]): void {
  const force = readStrandSpacingForceOverrides();
  if (force) {
    console.warn("[strand-spacing] FORCE overrides active", force);
  }

  for (const entry of entries) {
    const widthDeltaA = contactWidthStoredToTuningDelta(entry.contactWidthA);
    console.log(
      [
        `Bead ${entry.fromIndex + 1} -> Bead ${entry.toIndex + 1}`,
        `Contact Width: ${formatSpacingValue(entry.contactWidthA)} (delta ${formatSpacingValue(widthDeltaA)}, source ${entry.contactWidthSourceA})`,
        `Contact Adjustment: ${formatSpacingValue(entry.contactAdjustmentA)} (source ${entry.contactAdjustmentSourceA})`,
        `naturalTouchDistance = ${formatSpacingValue(entry.naturalTouchDistancePx)}`,
        `Calculated Distance: ${formatSpacingValue(entry.calculatedDistancePx)}`,
        `contactArcA = ${formatSpacingValue(entry.contactArcA)}`,
        `contactArcB = ${formatSpacingValue(entry.contactArcB)}`,
        `Final Distance: ${formatSpacingValue(entry.finalDistancePx)}`,
        `Bead ${entry.fromIndex + 1} x=${formatSpacingValue(entry.beadAX)} y=${formatSpacingValue(entry.beadAY)}`,
        `Bead ${entry.toIndex + 1} x=${formatSpacingValue(entry.beadBX)} y=${formatSpacingValue(entry.beadBY)}`,
      ].join("\n"),
    );
  }
}
