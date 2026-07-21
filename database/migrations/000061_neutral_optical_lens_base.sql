-- Replace-lens rendering now retains only normalized luminance/detail from the source lens.
-- Original hue is removed before the configured customer tint is applied. Storage remains
-- clip_config.render JSONB; this migration documents the updated optical-material semantics.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD defines replacement openings; frameExclusions[] restores frame hardware last. The renderer removes source lens hue, compresses retained luminance/detail to a neutral optical base, then applies catalogue tint, transmission, vertical lighting, reflection, and Fresnel edge depth. Optional render exposes high-level lensOpacity, lensTransmission, reflectionStrength, reflectionBlur, edgeDarkness, and frameExclusionOpacity; legacy detailed render keys remain readable.';
