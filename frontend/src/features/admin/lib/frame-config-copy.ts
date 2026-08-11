import {
  isBeadCropConfigValid,
  isLensClipConfigValid,
  type BeadCropConfig,
  type LensClipRenderSettings,
} from "@bino-foundry/shared/types";

import type { FrameEntry } from "@/data/glasses";
import { lensClipConfigToMaskConfig } from "@/render/lens-clip";
import {
  createMaskConfig,
  ensureFrameLensSet,
  hasAnyLensMask,
  isMaskConfigValid,
  migrateAnchors,
  resolveMaskFrameExclusions,
  type MaskConfig,
  type PathAnchor,
} from "@/render/mask";
import type { FrameRenderView } from "@/types/frame-rendering";
import { FRAME_VIEW_AXES } from "@/types/frame-rendering";

import { mergeMaskIntoView } from "./frame-render-flush";

/** Independent copy sections shown in the picker. */
export type FrameConfigCopySection =
  | "crop"
  | "lensPolygon"
  | "glassSheet"
  | "manualDetails"
  | "lensRendering"
  | "glassMaterial"
  | "allRendering"
  | "everything";

export type FrameConfigCopySelection = Record<FrameConfigCopySection, boolean>;

export type FrameConfigCopyConflictMode = "replace" | "merge";

export const EMPTY_FRAME_CONFIG_COPY_SELECTION: FrameConfigCopySelection = {
  crop: false,
  lensPolygon: false,
  glassSheet: false,
  manualDetails: false,
  lensRendering: false,
  glassMaterial: false,
  allRendering: false,
  everything: false,
};

export const FRAME_CONFIG_COPY_SECTION_LABELS: Record<FrameConfigCopySection, string> = {
  crop: "Crop",
  lensPolygon: "Lens Polygon",
  glassSheet: "Glass Sheet Configuration",
  manualDetails: "Manual Details / Smart Cutouts",
  lensRendering: "Lens Rendering Configuration",
  glassMaterial: "Glass Material Configuration",
  allRendering: "All Rendering Settings",
  everything: "Copy Everything",
};

/** Ordered UI checkboxes (everything last). */
export const FRAME_CONFIG_COPY_SECTION_ORDER: FrameConfigCopySection[] = [
  "crop",
  "lensPolygon",
  "glassSheet",
  "manualDetails",
  "lensRendering",
  "glassMaterial",
  "allRendering",
  "everything",
];

const GLASS_SHEET_KEYS = [
  "glassSheetEnabled",
  "glassSheetUrl",
  "glassSheetNaturalWidth",
  "glassSheetNaturalHeight",
  "glassSheetCrop",
  "glassSheetFit",
  "glassSheetScale",
  "glassSheetOffsetX",
  "glassSheetOffsetY",
  "glassSheetColorStrength",
  "glassSheetTextureStrength",
  "glassSheetShine",
  "glassSheetOccluderEnabled",
  "glassSheetOccluderStrength",
  "glassSheetOccluderThreshold",
] as const satisfies ReadonlyArray<keyof LensClipRenderSettings>;

const GLASS_MATERIAL_KEYS = [
  "automaticMaterialBehavior",
  "materialInfluence",
  "originalLensColorInfluence",
  "baseBrightness",
  "baseGamma",
  "baseSaturation",
  "glassAbsorption",
  "glassDiffusion",
  "glassDepth",
  "baseGlassDarkness",
  "baseGlassRichness",
  "baseGlassNeutralization",
  "glassMaterialStrength",
  "glassBaseDensity",
  "baseDensityBias",
] as const satisfies ReadonlyArray<keyof LensClipRenderSettings>;

export type ResolvedFrameConfigCopyFlags = {
  crop: boolean;
  lensPolygon: boolean;
  manualDetails: boolean;
  glassSheet: boolean;
  lensRendering: boolean;
  glassMaterial: boolean;
  /** Frame-level preset assignment. */
  presetAssignment: boolean;
};

/** Expand mega-options into concrete section flags. */
export function resolveFrameConfigCopyFlags(
  selection: FrameConfigCopySelection,
): ResolvedFrameConfigCopyFlags {
  if (selection.everything) {
    return {
      crop: true,
      lensPolygon: true,
      manualDetails: true,
      glassSheet: true,
      lensRendering: true,
      glassMaterial: true,
      presetAssignment: true,
    };
  }

  const allRendering = selection.allRendering;
  return {
    crop: selection.crop,
    lensPolygon: selection.lensPolygon,
    manualDetails: selection.manualDetails,
    glassSheet: allRendering || selection.glassSheet,
    lensRendering: allRendering || selection.lensRendering,
    glassMaterial: allRendering || selection.glassMaterial,
    presetAssignment: allRendering || selection.lensRendering || selection.glassMaterial,
  };
}

export function selectedFrameConfigCopySections(
  selection: FrameConfigCopySelection,
): FrameConfigCopySection[] {
  return FRAME_CONFIG_COPY_SECTION_ORDER.filter((section) => selection[section]);
}

export function hasAnyFrameConfigCopySelection(selection: FrameConfigCopySelection): boolean {
  return selectedFrameConfigCopySections(selection).length > 0;
}

function viewByAxis(
  views: FrameRenderView[] | undefined,
  axis: FrameRenderView["view"],
): FrameRenderView | undefined {
  return views?.find((v) => v.view === axis);
}

function destPlateSize(view: FrameRenderView): { width: number; height: number } {
  const width = view.width > 0 ? view.width : view.maskConfig?.imageWidth ?? view.clipConfig?.imageWidth ?? 0;
  const height =
    view.height > 0 ? view.height : view.maskConfig?.imageHeight ?? view.clipConfig?.imageHeight ?? 0;
  return { width, height };
}

/** Copy crop geometry only — retarget URLs to the destination plate (never clone assets). */
export function retargetCropConfig(
  sourceCrop: BeadCropConfig,
  dest: FrameRenderView,
): BeadCropConfig {
  const originalUrl =
    dest.originalPlateUrl?.trim() ||
    dest.plateUrl?.trim() ||
    ("originalUrl" in sourceCrop ? sourceCrop.originalUrl : "") ||
    "";
  const imageWidth =
    dest.originalWidth && dest.originalWidth > 0
      ? dest.originalWidth
      : dest.width > 0
        ? dest.width
        : sourceCrop.imageWidth;
  const imageHeight =
    dest.originalHeight && dest.originalHeight > 0
      ? dest.originalHeight
      : dest.height > 0
        ? dest.height
        : sourceCrop.imageHeight;

  if (sourceCrop.version === 1) {
    return {
      ...sourceCrop,
      originalUrl,
      imageWidth,
      imageHeight,
      processedUrl: undefined,
      updatedAt: Date.now(),
    };
  }

  return {
    ...sourceCrop,
    originalUrl,
    imageWidth,
    imageHeight,
    processedUrl: undefined,
    deliveryUrls: undefined,
    updatedAt: Date.now(),
  };
}

function cloneAnchor(p: PathAnchor): PathAnchor {
  return {
    x: p.x,
    y: p.y,
    curved: Boolean(p.curved),
    handleIn: p.handleIn ? { x: p.handleIn.x, y: p.handleIn.y } : null,
    handleOut: p.handleOut ? { x: p.handleOut.x, y: p.handleOut.y } : null,
  };
}

function cloneAnchors(points: PathAnchor[] | null | undefined): PathAnchor[] {
  return migrateAnchors(points ?? []).map(cloneAnchor);
}

/** Prefer stored mask anchors; fall back to rebuilding from SVG clip paths. */
export function resolveSourceMaskForCopy(view: FrameRenderView | undefined): MaskConfig | null {
  if (!view) return null;
  if (view.maskConfig && isMaskConfigValid(view.maskConfig)) {
    return view.maskConfig;
  }
  if (view.clipConfig && isLensClipConfigValid(view.clipConfig)) {
    return lensClipConfigToMaskConfig(view.clipConfig);
  }
  return null;
}

function cloneMaskOntoPlate(
  source: MaskConfig,
  width: number,
  height: number,
  options: { lenses: boolean; exclusions: boolean },
  existing?: MaskConfig | null,
): MaskConfig | null {
  if (!(width > 0) || !(height > 0)) return null;

  const lenses = options.lenses
    ? ensureFrameLensSet(source.lenses ?? []).map((lens) => ({
        ...lens,
        points: cloneAnchors(lens.points),
      }))
    : ensureFrameLensSet(existing?.lenses ?? []);

  let exclusions = options.exclusions
    ? resolveMaskFrameExclusions(source).map((part, index) => ({
        ...part,
        points: cloneAnchors(part.points),
        shapeBaseline: part.shapeBaseline?.length ? cloneAnchors(part.shapeBaseline) : part.shapeBaseline,
        holes: (part.holes ?? []).map((hole) => ({
          ...hole,
          points: cloneAnchors(hole.points),
          shapeBaseline: hole.shapeBaseline?.length ? cloneAnchors(hole.shapeBaseline) : hole.shapeBaseline,
        })),
        depth: part.depth ?? index,
        layerOrder: part.layerOrder ?? ("front" as const),
      }))
    : resolveMaskFrameExclusions(existing);

  if (!options.lenses && !options.exclusions) return existing ?? null;
  if (options.lenses && !hasAnyLensMask({ ...source, lenses }) && !options.exclusions) {
    return existing ?? null;
  }

  return createMaskConfig(width, height, lenses, undefined, exclusions);
}

function appendManualDetails(
  existing: MaskConfig | null | undefined,
  incoming: MaskConfig,
  width: number,
  height: number,
): MaskConfig {
  const baseLenses = ensureFrameLensSet(existing?.lenses ?? incoming.lenses ?? []);
  const current = resolveMaskFrameExclusions(existing);
  const seen = new Set(current.map((p) => p.id));
  const merged = [...current];
  for (const part of resolveMaskFrameExclusions(incoming)) {
    let id = part.id || `detail-${merged.length}`;
    while (seen.has(id)) id = `${id}-copy`;
    seen.add(id);
    merged.push({
      ...part,
      id,
      points: cloneAnchors(part.points),
      shapeBaseline: part.shapeBaseline?.length ? cloneAnchors(part.shapeBaseline) : part.shapeBaseline,
      holes: (part.holes ?? []).map((hole) => ({
        ...hole,
        points: cloneAnchors(hole.points),
        shapeBaseline: hole.shapeBaseline?.length
          ? cloneAnchors(hole.shapeBaseline)
          : hole.shapeBaseline,
      })),
      depth: part.depth ?? merged.length,
      layerOrder: part.layerOrder ?? "front",
    });
  }
  return createMaskConfig(width, height, baseLenses, undefined, merged);
}

function pickRenderKeys(
  source: LensClipRenderSettings | undefined,
  keys: ReadonlyArray<keyof LensClipRenderSettings>,
): Partial<LensClipRenderSettings> {
  if (!source) return {};
  const out: Partial<LensClipRenderSettings> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      (out as Record<string, unknown>)[key] = source[key];
    }
  }
  return out;
}

function lensRenderingPartial(
  source: LensClipRenderSettings | undefined,
): Partial<LensClipRenderSettings> {
  if (!source) return {};
  const skip = new Set<string>([...GLASS_SHEET_KEYS, ...GLASS_MATERIAL_KEYS]);
  const out: Partial<LensClipRenderSettings> = {};
  for (const [key, value] of Object.entries(source)) {
    if (skip.has(key)) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function stripRenderKeys(
  render: LensClipRenderSettings | undefined,
  keys: ReadonlyArray<keyof LensClipRenderSettings>,
): LensClipRenderSettings | undefined {
  if (!render) return undefined;
  const next = { ...render };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function applyRenderSections(
  destRender: LensClipRenderSettings | undefined,
  sourceRender: LensClipRenderSettings | undefined,
  flags: ResolvedFrameConfigCopyFlags,
  mode: FrameConfigCopyConflictMode,
): LensClipRenderSettings | undefined {
  if (!flags.glassSheet && !flags.lensRendering && !flags.glassMaterial) {
    return destRender;
  }

  if (flags.glassSheet && flags.lensRendering && flags.glassMaterial) {
    // Full render clone.
    if (mode === "merge" && destRender) {
      return { ...destRender, ...(sourceRender ?? {}) };
    }
    return sourceRender ? { ...sourceRender } : undefined;
  }

  let next: LensClipRenderSettings = { ...(destRender ?? {}) };

  if (flags.glassSheet) {
    if (mode === "replace") {
      next = stripRenderKeys(next, GLASS_SHEET_KEYS) ?? {};
    }
    next = { ...next, ...pickRenderKeys(sourceRender, GLASS_SHEET_KEYS) };
  }

  if (flags.glassMaterial) {
    if (mode === "replace") {
      next = stripRenderKeys(next, GLASS_MATERIAL_KEYS) ?? {};
    }
    next = { ...next, ...pickRenderKeys(sourceRender, GLASS_MATERIAL_KEYS) };
  }

  if (flags.lensRendering) {
    const partial = lensRenderingPartial(sourceRender);
    if (mode === "replace") {
      const sheet = pickRenderKeys(next, GLASS_SHEET_KEYS);
      const material = pickRenderKeys(next, GLASS_MATERIAL_KEYS);
      next = { ...sheet, ...material, ...partial };
    } else {
      next = { ...next, ...partial };
    }
  }

  return Object.keys(next).length ? next : undefined;
}

function sourceHasCrop(view: FrameRenderView | undefined): boolean {
  return Boolean(view?.plateCropConfig && isBeadCropConfigValid(view.plateCropConfig));
}

function sourceHasLens(view: FrameRenderView | undefined): boolean {
  if (view?.maskConfig && hasAnyLensMask(view.maskConfig)) return true;
  return Boolean(view?.clipConfig?.lenses?.some((l) => l.pathD?.trim()));
}

function sourceHasDetails(view: FrameRenderView | undefined): boolean {
  if (resolveMaskFrameExclusions(view?.maskConfig).length > 0) return true;
  return Boolean(view?.clipConfig?.frameExclusions?.length);
}

function sourceHasGlassSheet(view: FrameRenderView | undefined): boolean {
  const render = view?.clipConfig?.render;
  if (!render) return false;
  return Boolean(render.glassSheetUrl?.trim()) || GLASS_SHEET_KEYS.some((k) => render[k] != null);
}

function sourceHasLensRendering(view: FrameRenderView | undefined): boolean {
  const render = view?.clipConfig?.render;
  if (!render) return false;
  return Object.keys(lensRenderingPartial(render)).length > 0;
}

function sourceHasGlassMaterial(view: FrameRenderView | undefined): boolean {
  const render = view?.clipConfig?.render;
  if (!render) return false;
  return GLASS_MATERIAL_KEYS.some((k) => render[k] != null);
}

/** Which selected sections already have data on the destination (needs confirm). */
export function detectFrameConfigCopyConflicts(
  destination: Pick<FrameEntry, "renderViews" | "lensRenderPresetId" | "useLensRenderPreset">,
  selection: FrameConfigCopySelection,
): FrameConfigCopySection[] {
  const flags = resolveFrameConfigCopyFlags(selection);
  const conflicts: FrameConfigCopySection[] = [];
  const views = destination.renderViews ?? [];

  const anyDest = (pred: (v: FrameRenderView | undefined) => boolean) =>
    FRAME_VIEW_AXES.some((axis) => pred(viewByAxis(views, axis)));

  if (flags.crop && anyDest(sourceHasCrop)) conflicts.push("crop");
  if (flags.lensPolygon && anyDest(sourceHasLens)) conflicts.push("lensPolygon");
  if (flags.manualDetails && anyDest(sourceHasDetails)) conflicts.push("manualDetails");
  if (flags.glassSheet && anyDest(sourceHasGlassSheet)) conflicts.push("glassSheet");
  if (flags.lensRendering && anyDest(sourceHasLensRendering)) conflicts.push("lensRendering");
  if (flags.glassMaterial && anyDest(sourceHasGlassMaterial)) conflicts.push("glassMaterial");

  if (
    flags.presetAssignment &&
    (destination.lensRenderPresetId != null || destination.useLensRenderPreset === false)
  ) {
    // Represented under allRendering / everything in the summary when those were picked.
    if (selection.everything) {
      if (!conflicts.includes("everything")) conflicts.push("everything");
    } else if (selection.allRendering) {
      if (!conflicts.includes("allRendering")) conflicts.push("allRendering");
    }
  }

  return conflicts;
}

export type ApplyFrameConfigCopyResult = {
  renderViews: FrameRenderView[];
  lensRenderPresetId: string | null | undefined;
  useLensRenderPreset: boolean | undefined;
};

/**
 * Apply selected configuration from `source` onto `destination`.
 * Never copies plate image URLs — destination keeps its own uploads.
 */
export function applyFrameConfigCopy(options: {
  source: FrameEntry;
  destination: Pick<FrameEntry, "renderViews" | "lensRenderPresetId" | "useLensRenderPreset">;
  selection: FrameConfigCopySelection;
  conflictMode?: FrameConfigCopyConflictMode;
}): ApplyFrameConfigCopyResult {
  const { source, destination, selection } = options;
  const mode = options.conflictMode ?? "replace";
  const flags = resolveFrameConfigCopyFlags(selection);

  const nextViews = FRAME_VIEW_AXES.map((axis) => {
    const dest =
      viewByAxis(destination.renderViews, axis) ??
      ({
        view: axis,
        plateUrl: "",
        width: 0,
        height: 0,
        clipConfig: null,
        clipStatus: "draft" as const,
        maskConfig: null,
        maskStatus: "draft" as const,
      } satisfies FrameRenderView);
    const src = viewByAxis(source.renderViews, axis);
    if (!src) return dest;

    let next = { ...dest };

    if (flags.crop && src.plateCropConfig && isBeadCropConfigValid(src.plateCropConfig)) {
      // Geometry only — keep destination plate assets and pixel size.
      next = {
        ...next,
        plateCropConfig: retargetCropConfig(src.plateCropConfig, next),
      };
    }

    const size = destPlateSize(next);
    const wantLens = flags.lensPolygon;
    const wantDetails = flags.manualDetails;
    const srcMask = resolveSourceMaskForCopy(src);

    if ((wantLens || wantDetails) && srcMask && isMaskConfigValid(srcMask)) {
      let mask: MaskConfig | null = null;
      if (wantDetails && mode === "merge" && !wantLens) {
        mask = appendManualDetails(
          next.maskConfig,
          srcMask,
          size.width || srcMask.imageWidth,
          size.height || srcMask.imageHeight,
        );
      } else if (wantDetails && mode === "merge" && wantLens) {
        const lensesFirst = cloneMaskOntoPlate(
          srcMask,
          size.width || srcMask.imageWidth,
          size.height || srcMask.imageHeight,
          { lenses: true, exclusions: false },
          next.maskConfig,
        );
        mask = lensesFirst
          ? appendManualDetails(lensesFirst, srcMask, lensesFirst.imageWidth, lensesFirst.imageHeight)
          : null;
      } else {
        mask = cloneMaskOntoPlate(
          srcMask,
          size.width || srcMask.imageWidth,
          size.height || srcMask.imageHeight,
          { lenses: wantLens, exclusions: wantDetails },
          next.maskConfig,
        );
      }

      if (mask) {
        next = mergeMaskIntoView(next, mask);
      }
    }

    const render = applyRenderSections(
      next.clipConfig?.render,
      src.clipConfig?.render,
      flags,
      mode,
    );
    if (flags.glassSheet || flags.lensRendering || flags.glassMaterial) {
      if (next.clipConfig) {
        next = {
          ...next,
          clipConfig: { ...next.clipConfig, render, updatedAt: Date.now() },
        };
      } else if (render && src.clipConfig?.lenses?.length) {
        // Rendering without geometry yet — carry source clip lenses as a last resort so
        // settings have a valid clip container; destination plate size is preferred.
        next = {
          ...next,
          clipConfig: {
            version: 1,
            imageWidth: size.width || src.clipConfig.imageWidth || 1,
            imageHeight: size.height || src.clipConfig.imageHeight || 1,
            lenses: src.clipConfig.lenses,
            frameExclusions: flags.manualDetails ? src.clipConfig.frameExclusions : undefined,
            render,
            updatedAt: Date.now(),
          },
        };
      }
    }

    return next;
  });

  let lensRenderPresetId = destination.lensRenderPresetId;
  let useLensRenderPreset = destination.useLensRenderPreset;
  if (flags.presetAssignment) {
    lensRenderPresetId = source.lensRenderPresetId ?? null;
    useLensRenderPreset = source.useLensRenderPreset !== false;
  }

  return {
    renderViews: nextViews,
    lensRenderPresetId,
    useLensRenderPreset,
  };
}

export type FramePickerSort = "recentlyEdited" | "recentlyCreated" | "name";

export type FramePickerItem = FrameEntry & {
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function filterFramePickerItems(
  frames: FramePickerItem[],
  options: {
    query?: string;
    family?: string | "all" | "none";
    excludeId?: string | null;
    sort?: FramePickerSort;
  },
): FramePickerItem[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const family = options.family ?? "all";
  const sort = options.sort ?? "recentlyEdited";

  let list = frames.filter((f) => {
    if (options.excludeId && f.id === options.excludeId) return false;
    if (family === "none" && f.modelFamily?.trim()) return false;
    if (family !== "all" && family !== "none" && f.modelFamily?.trim() !== family) return false;
    if (!query) return true;
    return (
      f.name.toLowerCase().includes(query) ||
      Boolean(f.modelFamily?.toLowerCase().includes(query))
    );
  });

  list = [...list].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const aKey =
      sort === "recentlyCreated"
        ? Date.parse(String(a.createdAt ?? "")) || 0
        : Date.parse(String(a.updatedAt ?? a.createdAt ?? "")) || 0;
    const bKey =
      sort === "recentlyCreated"
        ? Date.parse(String(b.createdAt ?? "")) || 0
        : Date.parse(String(b.updatedAt ?? b.createdAt ?? "")) || 0;
    if (bKey !== aKey) return bKey - aKey;
    return a.name.localeCompare(b.name);
  });

  return list;
}

export function framePickerThumbnail(frame: FrameEntry): string | null {
  const front = frame.renderViews?.find((v) => v.view === "front");
  return front?.plateUrl?.trim() || frame.frameImages?.[0]?.trim() || null;
}
