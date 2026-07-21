-- Tint Layer Opacity is the final opacity written directly on each SVG tint path.
-- The gradient reference (fill="url(#...-tint)") remains renderer-internal and is never
-- configurable. Storage remains clip_config.render JSONB; absent keys default to 0.43.
-- Legacy tintFilterOpacity is still read for backward compatibility.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per frame view. Optional render.tintLayerOpacity (0-1, default 0.43) is applied directly to the opacity attribute of both lens tint paths; the internal SVG tint gradient reference is not configurable. Other high-level opacity controls include lensOpacity, reflectionOpacity, highlightStrength, edgeDarkness, and frameExclusionOpacity. Settings may be shared across views (default admin mode) or configured per view. Legacy tintFilterOpacity remains readable for backward compatibility.';
