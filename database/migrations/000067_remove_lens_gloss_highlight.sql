-- Removes the white specular/gloss highlight from lens rendering and softens the reflection
-- to a subtle neutral glass sheen. Admin no longer exposes Highlight Opacity. Storage is
-- unchanged (clip_config.render JSONB); legacy gloss/highlight keys are ignored by the
-- renderer. Retained admin controls: tintLayerOpacity, lensOpacity, reflectionOpacity,
-- edgeDarkness. No columns changed.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per view. Optional render { renderScope: global|front|side, tintLayerOpacity, lensOpacity, reflectionOpacity, edgeDarkness }. tintLayerOpacity is applied directly to both tint path opacity attributes; fill url(#...-tint) stays internal. Reflection is a soft neutral glass sheen (no white specular/gloss). Legacy gloss/highlight keys (glossEnabled, glossStrength, highlightStrength) are ignored. Missing values preserve renderer defaults (tintLayerOpacity 0.42978, lensOpacity 0.9, reflectionOpacity 0.2, edgeDarkness 0.24).';
