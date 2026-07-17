-- Lens clip_config JSONB shape documentation (no schema change — still JSONB).
-- clip_config.render drives synthetic replace-lens optics; frameExclusions overlay frame bits.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings), optional frameExclusions[] (overlays above synthetic lens), optional render { mode, tintOpacity, gradient*, reflection*, gloss*, vignette*, polarized* }. Customer tint colours come from sunglasses_lens_tints; render tunes optical layers inside the polygons.';
