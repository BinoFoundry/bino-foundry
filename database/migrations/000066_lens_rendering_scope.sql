-- Advanced lens-rendering controls remain in each view's existing clip_config.render JSONB.
-- renderScope selects global/front/side administration; out-of-scope views omit custom
-- opacity keys and therefore resolve the renderer's unchanged defaults. No columns added.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per view. Optional render { renderScope: global|front|side, tintLayerOpacity, lensOpacity, reflectionOpacity, highlightStrength, edgeDarkness }. tintLayerOpacity is applied directly to both tint path opacity attributes; fill url(#...-tint) stays internal. Global scope copies one configuration to front and side. Front/side scope applies custom values only to that view while the other resolves renderer defaults. Missing values preserve renderer defaults (tintLayerOpacity 0.42978, lensOpacity 0.9, reflectionOpacity 0.2, highlightStrength 0.12, edgeDarkness 0.24).';
