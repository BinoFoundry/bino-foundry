-- Seed prototype material-layer keys into system defaults and presets.
-- Original lens remains the foundation; these layers enhance it (lens-glass-clip.html model).

BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object(
  'glassTintBlend', COALESCE(value->'glassTintBlend', '"kaca"'::jsonb),
  'glassTintShine', COALESCE(value->'glassTintShine', '55'::jsonb),
  'glassTintEnabled', COALESCE(value->'glassTintEnabled', 'true'::jsonb),
  'darkLayerEnabled', COALESCE(value->'darkLayerEnabled', 'true'::jsonb),
  'darkLayerOpacity', COALESCE(
    value->'darkLayerOpacity',
    value->'baseGlassDarkness',
    '28'::jsonb
  ),
  'darkLayerMode', COALESCE(value->'darkLayerMode', '"gradasi"'::jsonb),
  'darkLayerColor', COALESCE(value->'darkLayerColor', '"#0A0A0A"'::jsonb),
  'darkLayerBlend', COALESCE(value->'darkLayerBlend', '"source-over"'::jsonb),
  'darkLayerGlow', COALESCE(value->'darkLayerGlow', '42'::jsonb),
  'darkLayerGlowSize', COALESCE(value->'darkLayerGlowSize', '55'::jsonb),
  'darkLayerGlowX', COALESCE(value->'darkLayerGlowX', '45'::jsonb),
  'darkLayerGlowY', COALESCE(value->'darkLayerGlowY', '34'::jsonb),
  'darkLayerSoft', COALESCE(value->'darkLayerSoft', '70'::jsonb),
  'darkLayerEdge', COALESCE(value->'darkLayerEdge', '28'::jsonb),
  'edgeEnabled', COALESCE(value->'edgeEnabled', 'true'::jsonb)
)
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings = settings || jsonb_build_object(
  'glassTintBlend', COALESCE(settings->'glassTintBlend', '"kaca"'::jsonb),
  'glassTintShine', COALESCE(settings->'glassTintShine', '55'::jsonb),
  'glassTintEnabled', COALESCE(settings->'glassTintEnabled', 'true'::jsonb),
  'darkLayerEnabled', COALESCE(settings->'darkLayerEnabled', 'true'::jsonb),
  'darkLayerOpacity', COALESCE(
    settings->'darkLayerOpacity',
    settings->'baseGlassDarkness',
    '28'::jsonb
  ),
  'darkLayerMode', COALESCE(settings->'darkLayerMode', '"gradasi"'::jsonb),
  'darkLayerColor', COALESCE(settings->'darkLayerColor', '"#0A0A0A"'::jsonb),
  'darkLayerBlend', COALESCE(settings->'darkLayerBlend', '"source-over"'::jsonb),
  'darkLayerGlow', COALESCE(settings->'darkLayerGlow', '42'::jsonb),
  'darkLayerGlowSize', COALESCE(settings->'darkLayerGlowSize', '55'::jsonb),
  'darkLayerGlowX', COALESCE(settings->'darkLayerGlowX', '45'::jsonb),
  'darkLayerGlowY', COALESCE(settings->'darkLayerGlowY', '34'::jsonb),
  'darkLayerSoft', COALESCE(settings->'darkLayerSoft', '70'::jsonb),
  'darkLayerEdge', COALESCE(settings->'darkLayerEdge', '28'::jsonb),
  'edgeEnabled', COALESCE(settings->'edgeEnabled', 'true'::jsonb)
);

COMMIT;
