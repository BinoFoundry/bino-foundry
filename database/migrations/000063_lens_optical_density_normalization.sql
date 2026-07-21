-- Lens rendering now calibrates every frame to a fixed optical-density baseline before the
-- customer tint is applied: source hue is removed and luminance/exposure is clamped around a
-- constant mid-grey, so identical tint settings read at the same perceived darkness across
-- all frame assets. Realistic glass texture (subtle depth, reflection, highlights) is kept.
-- Storage remains clip_config.render JSONB; this migration documents the semantics only.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings), optional frameExclusions[] (restored above synthetic lens). Renderer removes source lens hue and normalizes luminance/exposure to a fixed optical-density baseline so the same tint renders at consistent perceived density on every frame, then applies catalogue tint (only colour source), transmission, reflection, and Fresnel edge depth. Optional render { lensOpacity, lensTransmission, reflectionStrength, reflectionBlur, edgeDarkness, frameExclusionOpacity }.';
