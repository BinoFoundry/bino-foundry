import type { LensPolygon } from "@/render/mask";
import { migrateAnchors, resolveMaskFrameExclusions, type MaskConfig } from "@/render/mask";

export interface DetailStamp {
  id: string;
  name: string;
  /** Normalized Manual Details polygons (Above Glass). */
  parts: LensPolygon[];
  updatedAt: number;
}

const STORAGE_PREFIX = "bino-detail-stamps-v1:";

function familyKey(modelFamily: string | null | undefined): string | null {
  const trimmed = modelFamily?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function storageKey(modelFamily: string): string {
  return `${STORAGE_PREFIX}${familyKey(modelFamily)}`;
}

function readStamps(modelFamily: string): DetailStamp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(modelFamily));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DetailStamp[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === "string" && Array.isArray(s.parts));
  } catch {
    return [];
  }
}

function writeStamps(modelFamily: string, stamps: DetailStamp[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(modelFamily), JSON.stringify(stamps));
  } catch {
    /* ignore quota */
  }
}

export function listDetailStamps(modelFamily: string | null | undefined): DetailStamp[] {
  const key = familyKey(modelFamily);
  if (!key) return [];
  return readStamps(key).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveDetailStampFromMask(
  modelFamily: string | null | undefined,
  name: string,
  mask: MaskConfig | null | undefined,
): DetailStamp | null {
  const key = familyKey(modelFamily);
  const stampName = name.trim();
  if (!key || !stampName || !mask) return null;
  const parts = resolveMaskFrameExclusions(mask).map((part, index) => ({
    ...part,
    id: `stamp-part-${Date.now()}-${index}`,
    points: migrateAnchors(part.points ?? []),
    holes: [],
    layerOrder: "front" as const,
  }));
  if (parts.length === 0) return null;

  const stamp: DetailStamp = {
    id: `stamp-${Date.now().toString(36)}`,
    name: stampName.slice(0, 80),
    parts,
    updatedAt: Date.now(),
  };
  const next = [stamp, ...readStamps(key).filter((s) => s.name.toLowerCase() !== stamp.name.toLowerCase())];
  writeStamps(key, next.slice(0, 40));
  return stamp;
}

export function deleteDetailStamp(modelFamily: string | null | undefined, stampId: string): void {
  const key = familyKey(modelFamily);
  if (!key) return;
  writeStamps(
    key,
    readStamps(key).filter((s) => s.id !== stampId),
  );
}

/** Merge stamp parts into a mask as new Manual Details (keeps existing lenses). */
export function applyDetailStampToMask(
  mask: MaskConfig,
  stamp: DetailStamp,
): MaskConfig {
  const existing = resolveMaskFrameExclusions(mask);
  const imported = stamp.parts.map((part, index) => ({
    ...part,
    id: `applied-${Date.now()}-${index}`,
    points: migrateAnchors(part.points ?? []),
    holes: [],
    layerOrder: "front" as const,
    depth: existing.length + index,
  }));
  return {
    ...mask,
    frameExclusions: [...existing, ...imported],
    updatedAt: Date.now(),
  };
}
