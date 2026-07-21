-- Adds "Tint Filter Opacity" and per-view lens rendering to clip_config.render (JSONB).
-- No schema/column change: tintFilterOpacity is an optional render key, and each frame view
-- already stores its own clip_config, so views may share one set of settings (default) or be
-- configured independently. Existing installations keep working; absent keys use defaults.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per frame view: lenses[].pathD (openings), optional frameExclusions[] (restored above synthetic lens). Renderer normalizes source luminance/exposure to a fixed optical-density baseline, then applies catalogue tint (only colour source), transmission, reflection, and Fresnel edge depth. Optional render { tintFilterOpacity (perceived lens thickness, 0-1), lensOpacity, lensTransmission, reflectionStrength, reflectionOpacity, reflectionBlur, glossStrength, edgeDarkness, frameExclusionOpacity }. Settings are per view; the admin may share one set across all views or tune each view independently.';
