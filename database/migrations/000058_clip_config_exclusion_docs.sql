-- Document per-lens exclusion holes inside clip_config (JSONB shape unchanged).
-- Exclusions are stored on lenses[].exclusions[], not as a separate column.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings), optional lenses[].exclusions[] (holes carved from each opening so frame hardware stays untinted), optional render { mode, tintOpacity, transparency, brightness, contrast, saturation, gradient*, reflection*, gloss*, edgeFade/vignette*, polarized* }. Legacy root frameExclusions are migrated onto per-lens exclusions on read/write. Customer tint colours come from sunglasses_lens_tints; render tunes optical layers inside Lens Clip − Exclusions.';
