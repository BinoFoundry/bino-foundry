-- Frame Exclusions are now frame-level (not per-lens): they describe frame hardware
-- (bridge, screws, inner rim, support bars) that sits inside the lens openings and is
-- restored ABOVE the rendered lens so it stays visible regardless of tint.
--
-- Storage is unchanged (JSONB) — no column changes. Canonical location is
-- clip_config.frameExclusions[]; legacy per-lens clip_config.lenses[].exclusions[] is still
-- read and merged for backward compatibility. Frames without exclusions render exactly as
-- before. This migration only refreshes the documentation comment.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings) + optional frame-level frameExclusions[] (frame parts inside the opening, restored above the lens as an overlay so they stay visible). Legacy lenses[].exclusions[] and root frameExclusions[].lensId are still read and merged for back-compat. Optional render { mode, tintOpacity, transparency, brightness, contrast, saturation, gradient*, reflection*, gloss*, edgeFade/vignette*, polarized* }. Customer tint colours come from sunglasses_lens_tints.';
