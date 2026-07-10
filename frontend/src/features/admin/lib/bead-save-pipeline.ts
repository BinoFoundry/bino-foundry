import type { BeadLibrarySizeInput } from "@/types/bead-library-sizes";
import type { BeadLibraryEntry } from "@/types/beads";
import type { BeadCropConfig } from "@bino-foundry/shared/types";

const DEV = import.meta.env.DEV;

export interface BeadSavePerfEntry {
  step: string;
  ms: number;
}

export interface BeadSaveDiff {
  libraryPayload: Partial<BeadLibraryEntry>;
  sizes: BeadLibrarySizeInput[];
  sizesChanged: boolean;
  cropChanged: boolean;
  metadataChanged: boolean;
}

function stripCropTimestamp(config: BeadCropConfig): Omit<BeadCropConfig, "updatedAt"> {
  const { updatedAt: _u, ...rest } = config as BeadCropConfig & { updatedAt?: number };
  return rest;
}

export function cropConfigSemanticallyEqual(
  a: BeadCropConfig | null | undefined,
  b: BeadCropConfig | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(stripCropTimestamp(a)) === JSON.stringify(stripCropTimestamp(b));
}

export function librarySizesSemanticallyEqual(
  a: BeadLibrarySizeInput[],
  b: BeadLibrarySizeInput[],
): boolean {
  const norm = (rows: BeadLibrarySizeInput[]) =>
    rows
      .map((row) => ({
        sizeMm: Number(row.sizeMm),
        unitPrice: Number(row.unitPrice),
        isDefault: row.isDefault === true,
      }))
      .sort((x, y) => x.sizeMm - y.sizeMm);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function buildBeadSaveDiff(
  initial: BeadLibraryEntry | undefined,
  next: BeadLibraryEntry,
  sizes: BeadLibrarySizeInput[],
  initialSizes: BeadLibrarySizeInput[],
): BeadSaveDiff {
  const sizesChanged = !librarySizesSemanticallyEqual(sizes, initialSizes);
  const cropChanged = !cropConfigSemanticallyEqual(initial?.cropConfig ?? null, next.cropConfig ?? null);
  const metadataChanged =
    JSON.stringify(initial?.metadata ?? {}) !== JSON.stringify(next.metadata ?? {});

  const libraryPayload: Partial<BeadLibraryEntry> = {};

  if (!initial || initial.name !== next.name) libraryPayload.name = next.name;
  if (!initial || initial.beadTypeId !== next.beadTypeId) libraryPayload.beadTypeId = next.beadTypeId;
  if (!initial || initial.subBeadTypeId !== next.subBeadTypeId) libraryPayload.subBeadTypeId = next.subBeadTypeId;
  if (!initial || initial.description !== next.description) libraryPayload.description = next.description;
  if (!initial || initial.isActive !== next.isActive) libraryPayload.isActive = next.isActive;
  if (!initial || initial.availabilityStatusCode !== next.availabilityStatusCode) {
    libraryPayload.availabilityStatusCode = next.availabilityStatusCode;
  }
  if (!initial || initial.displayOrder !== next.displayOrder) libraryPayload.displayOrder = next.displayOrder;

  if (metadataChanged) {
    libraryPayload.metadata = next.metadata;
  }

  if (cropChanged) {
    libraryPayload.cropConfig = next.cropConfig ?? null;
    libraryPayload.cropStatus = next.cropStatus;
    libraryPayload.processedImage = next.processedImage;
    libraryPayload.originalImage = next.originalImage;
  } else if (
    initial?.processedImage !== next.processedImage &&
    next.processedImage?.trim()
  ) {
    libraryPayload.processedImage = next.processedImage;
  }

  return {
    libraryPayload,
    sizes,
    sizesChanged,
    cropChanged,
    metadataChanged,
  };
}

export class BeadSavePerf {
  private readonly started = performance.now();
  private readonly entries: BeadSavePerfEntry[] = [];

  async measure<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    try {
      return await fn();
    } finally {
      this.entries.push({ step, ms: performance.now() - t0 });
    }
  }

  finish(label = "Bead save"): void {
    if (!DEV) return;
    const total = performance.now() - this.started;
    const lines = this.entries.map((e) => `  ${e.step}: ${e.ms.toFixed(1)}ms`).join("\n");
    console.info(`[perf] ${label} ${total.toFixed(1)}ms\n${lines}`);
  }
}
