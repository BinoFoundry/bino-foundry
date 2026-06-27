import {
  deriveBeadVisualBoundsNorm,
  resolveBeadPhysicalMetrics as resolvePhysicalMetricsFromConfig,
  resolveBeadPhysicalMetricsForRender as resolvePhysicalMetricsForRenderFromConfig,
  type BeadCropConfig,
  type BeadCropPhysicalMetrics,
  type BeadCropMetricsResolution,
} from "@bino-foundry/shared/types";
import type { BeadLibraryEntry } from "@/types/beads";

import { resolveBeadCropConfig } from "./resolve-bead-crop-config";

/** Normalized visible silhouette of a bead crop (0–1 relative to source image). */
export type BeadVisualBoundsNorm = import("@bino-foundry/shared/types").BeadVisualBoundsStored;

const boundsCache = new Map<string, BeadVisualBoundsNorm>();
const BOUNDS_CACHE_MAX = 512;

function cacheKeyForBead(bead: BeadLibraryEntry): string {
  const config = resolveBeadCropConfig(bead);
  const stamp =
    config && typeof config === "object" && "updatedAt" in config ? (config.updatedAt ?? 0) : 0;
  return `${bead.id}:${stamp}:${bead.processedImage ?? ""}`;
}

function evictBoundsCacheIfNeeded(): void {
  if (boundsCache.size <= BOUNDS_CACHE_MAX) return;
  const drop = Math.ceil(BOUNDS_CACHE_MAX * 0.25);
  const keys = boundsCache.keys();
  for (let i = 0; i < drop; i++) {
    const next = keys.next();
    if (next.done) break;
    boundsCache.delete(next.value);
  }
}

export function beadVisualBoundsFromCropConfig(
  config: BeadCropConfig | null | undefined,
): BeadVisualBoundsNorm {
  return deriveBeadVisualBoundsNorm(config);
}

export function resolveBeadPhysicalMetrics(
  bead: BeadLibraryEntry | null | undefined,
): BeadCropPhysicalMetrics | null {
  return resolveBeadPhysicalMetricsAudit(bead)?.metrics ?? null;
}

export function resolveBeadPhysicalMetricsAudit(
  bead: BeadLibraryEntry | null | undefined,
): BeadCropMetricsResolution | null {
  return resolvePhysicalMetricsFromConfig(resolveBeadCropConfig(bead));
}

/** Bracelet render sizing — prefers mask-based metadata; falls back when processed export exists. */
export function resolveBeadPhysicalMetricsForRender(
  bead: BeadLibraryEntry | null | undefined,
): BeadCropMetricsResolution | null {
  return resolvePhysicalMetricsForRenderFromConfig(resolveBeadCropConfig(bead));
}

export function resolveBeadVisualBoundsNorm(
  bead: BeadLibraryEntry | null | undefined,
): BeadVisualBoundsNorm {
  if (!bead) {
    return { width: 1, height: 1, centerX: 0.5, centerY: 0.5 };
  }

  const key = cacheKeyForBead(bead);
  const cached = boundsCache.get(key);
  if (cached) return cached;

  const bounds = deriveBeadVisualBoundsNorm(resolveBeadCropConfig(bead) ?? null);
  boundsCache.set(key, bounds);
  evictBoundsCacheIfNeeded();
  return bounds;
}

/** Clear module cache (tests). */
export function clearBeadVisualBoundsCache(): void {
  boundsCache.clear();
}
