-- Customer catalogue tint is the sole chromatic source inside lens clips. The renderer
-- knocks out the original coloured lens and paints synthetic glass; frame render settings
-- tune transmission/reflection/edge depth only. JSONB storage unchanged.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON: lenses[].pathD (openings), optional frameExclusions[] (restored above synthetic lens). Renderer removes original lens colour completely, paints achromatic glass substrate + catalogue tint as the only hue source, then applies transmission/reflection/Fresnel depth. Optional render { lensOpacity, lensTransmission, reflectionStrength, reflectionBlur, edgeDarkness, frameExclusionOpacity }. Per-frame gradient colour overrides must not replace catalogue tint.';
