import {
  LENS_RENDER_SYSTEM_DEFAULTS,
  pickLensRenderPresetSettings,
  pruneLensRenderOverride,
  resolveLensRenderConfig,
  type LensClipRenderSettings,
  type LensRenderingPreset,
  type LensRenderConfigSource,
} from "@bino-foundry/shared/types";

import type { FrameEntry } from "@/data/glasses";
import type { FrameRenderView } from "@/types/frame-rendering";
import type { LensClipConfig } from "@bino-foundry/shared/types";

import { DEFAULT_LENS_CLIP_RENDER } from "./clip-settings";

export interface FrameLensRenderAssignment {
  lensRenderPresetId?: string | null;
  useLensRenderPreset?: boolean;
}

/** Resolve which preset a frame uses (explicit id → default → null). */
export function resolveAssignedLensRenderPreset(
  frame: FrameLensRenderAssignment,
  presets: LensRenderingPreset[],
): LensRenderingPreset | null {
  if (frame.lensRenderPresetId) {
    const matched = presets.find((p) => p.id === frame.lensRenderPresetId);
    if (matched) return matched;
  }
  return presets.find((p) => p.isDefault) ?? presets[0] ?? null;
}

/**
 * Resolve material settings for a frame view:
 * Frame Override → Preset → System Default.
 */
export function resolveFrameLensRenderSettings(
  frame: FrameLensRenderAssignment,
  viewRender: LensClipRenderSettings | null | undefined,
  presets: LensRenderingPreset[],
): ReturnType<typeof resolveLensRenderConfig> {
  const preset = resolveAssignedLensRenderPreset(frame, presets);
  const usePreset = frame.useLensRenderPreset !== false;
  return resolveLensRenderConfig({
    systemDefaults: {
      ...LENS_RENDER_SYSTEM_DEFAULTS,
      ...pickLensRenderPresetSettings(DEFAULT_LENS_CLIP_RENDER),
    },
    preset: preset?.settings ?? null,
    frameOverride: usePreset ? null : pickLensRenderPresetSettings(viewRender),
    usePreset,
  });
}

/** Stamp resolved material settings onto a clip config for the compositor (ephemeral). */
export function withResolvedLensRender(
  clipConfig: LensClipConfig | null | undefined,
  material: LensClipRenderSettings,
): LensClipConfig | null {
  if (!clipConfig) return null;
  return {
    ...clipConfig,
    render: {
      ...clipConfig.render,
      ...pickLensRenderPresetSettings(material),
    },
  };
}

/** Apply hierarchy to every view on a frame for live / customer rendering. */
export function applyLensRenderHierarchyToFrameViews(
  frame: FrameEntry,
  presets: LensRenderingPreset[],
): FrameRenderView[] {
  const views = frame.renderViews ?? [];
  return views.map((view) => {
    if (!view.clipConfig) return view;
    const material = resolveFrameLensRenderSettings(frame, view.clipConfig.render, presets);
    const { provenance: _p, source: _s, ...settings } = material;
    return {
      ...view,
      clipConfig: withResolvedLensRender(view.clipConfig, settings),
    };
  });
}

export function frameLensRenderSource(
  frame: FrameLensRenderAssignment,
  viewRender: LensClipRenderSettings | null | undefined,
  presets: LensRenderingPreset[],
): LensRenderConfigSource {
  return resolveFrameLensRenderSettings(frame, viewRender, presets).source;
}

/** Persist only sparse diffs when the frame opts out of full preset inheritance. */
export function buildSparseFrameRenderOverride(
  presetSettings: LensClipRenderSettings | null | undefined,
  edited: LensClipRenderSettings,
): LensClipRenderSettings {
  return pruneLensRenderOverride(
    {
      ...LENS_RENDER_SYSTEM_DEFAULTS,
      ...pickLensRenderPresetSettings(presetSettings),
    },
    edited,
  );
}
