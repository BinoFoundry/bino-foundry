-- Premium replace-lens optics are stored in clip_config.render (JSONB, no column change).
-- lensTransmission, edgeDarkness, and edgeWidth tune glass transmission, rim depth, and
-- inner-edge width independently from lensOpacity / frameExclusionOpacity.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings) + optional frame-level frameExclusions[] (restored above the synthetic lens). Optional render { mode, tintOpacity, lensOpacity, lensTransmission, frameExclusionOpacity, brightness, contrast, saturation, gradient*, reflection*, gloss*, edgeFade/vignette*, edgeDarkness, edgeWidth, polarized* }. Customer tint colours come from sunglasses_lens_tints; render tunes neutral replacement glass inside the clip. Legacy lenses[].exclusions[] is merged into frameExclusions on read.';
