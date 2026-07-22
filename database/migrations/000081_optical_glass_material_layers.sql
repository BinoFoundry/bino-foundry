-- Independent optical material controls and reusable copy-only material profiles.
-- Profiles populate settings; they are not an inheritance tier.

BEGIN;

UPDATE public.config_kv
SET value =
  jsonb_build_object(
    'reflectionOffsetX', -10,
    'reflectionOffsetY', -8,
    'internalReflectionEnabled', true,
    'internalReflectionOpacity', 0.04,
    'internalReflectionSoftness', 0.86,
    'internalReflectionScale', 0.92,
    'internalReflectionAngle', 338,
    'fresnelEnabled', true,
    'fresnelStrength', 0.12,
    'fresnelWidth', 0.18,
    'fresnelSoftness', 0.72,
    'edgeSoftness', 0.68,
    'edgeOpacity', 0.24
  ) || value
WHERE key = 'sunglasses.lens_render_defaults_v1';

UPDATE public.lens_rendering_presets
SET settings =
  jsonb_build_object(
    'reflectionOffsetX', -10,
    'reflectionOffsetY', -8,
    'internalReflectionEnabled', true,
    'internalReflectionOpacity', 0.04,
    'internalReflectionSoftness', 0.86,
    'internalReflectionScale', 0.92,
    'internalReflectionAngle', 338,
    'fresnelEnabled', true,
    'fresnelStrength', 0.12,
    'fresnelWidth', 0.18,
    'fresnelSoftness', 0.72,
    'edgeSoftness', 0.68,
    'edgeOpacity', 0.24
  ) || settings,
  updated_at = now()
WHERE code IN ('clear', 'light-tint', 'classic-tint', 'dark-tint');

CREATE TABLE public.lens_material_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lens_material_profiles_code_trim CHECK (trim(code) <> ''),
  CONSTRAINT lens_material_profiles_name_trim CHECK (trim(name) <> '')
);

CREATE INDEX idx_lens_material_profiles_active_sort
  ON public.lens_material_profiles (is_active, display_order, name);

CREATE TRIGGER trg_lens_material_profiles_updated_at
  BEFORE UPDATE ON public.lens_material_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.lens_material_profiles
  (code, name, description, display_order, settings)
VALUES
  (
    'classic-glass',
    'Classic Glass',
    'Balanced premium optical depth with soft studio reflections.',
    10,
    '{"automaticMaterialBehavior":false,"glassAbsorption":30,"glassDiffusion":18,"glassDepth":50,"lensTransmission":0.52,"reflectionEnabled":true,"reflectionOpacity":0.16,"reflectionStrength":0.42,"reflectionBlur":0.76,"reflectionScale":1.1,"reflectionOffsetX":-10,"reflectionOffsetY":-8,"internalReflectionEnabled":true,"internalReflectionOpacity":0.04,"internalReflectionSoftness":0.86,"internalReflectionScale":0.92,"internalReflectionAngle":338,"fresnelEnabled":true,"fresnelStrength":0.12,"fresnelWidth":0.18,"fresnelSoftness":0.72,"edgeDensity":0.18,"edgeSoftness":0.68,"edgeOpacity":0.24}'::jsonb
  ),
  (
    'fashion-tint',
    'Fashion Tint',
    'Higher transmission and softer edges for light fashion lenses.',
    20,
    '{"automaticMaterialBehavior":false,"glassAbsorption":16,"glassDiffusion":24,"glassDepth":38,"lensTransmission":0.72,"reflectionEnabled":true,"reflectionOpacity":0.11,"reflectionStrength":0.34,"reflectionBlur":0.86,"reflectionScale":1.18,"reflectionOffsetX":-12,"reflectionOffsetY":-10,"internalReflectionEnabled":true,"internalReflectionOpacity":0.025,"internalReflectionSoftness":0.92,"internalReflectionScale":1.02,"internalReflectionAngle":340,"fresnelEnabled":true,"fresnelStrength":0.08,"fresnelWidth":0.14,"fresnelSoftness":0.82,"edgeDensity":0.1,"edgeSoftness":0.8,"edgeOpacity":0.14}'::jsonb
  ),
  (
    'polarized',
    'Polarized',
    'Controlled transmission with restrained polarized surface response.',
    30,
    '{"automaticMaterialBehavior":false,"glassAbsorption":38,"glassDiffusion":14,"glassDepth":58,"lensTransmission":0.38,"reflectionEnabled":true,"reflectionOpacity":0.14,"reflectionStrength":0.4,"reflectionBlur":0.72,"reflectionScale":1.08,"reflectionOffsetX":-8,"reflectionOffsetY":-7,"internalReflectionEnabled":true,"internalReflectionOpacity":0.035,"internalReflectionSoftness":0.82,"internalReflectionScale":0.9,"internalReflectionAngle":336,"fresnelEnabled":true,"fresnelStrength":0.14,"fresnelWidth":0.2,"fresnelSoftness":0.68,"edgeDensity":0.24,"edgeSoftness":0.62,"edgeOpacity":0.3,"polarizedEnabled":true,"polarizedStrength":0.12}'::jsonb
  ),
  (
    'mirror',
    'Mirror',
    'Stronger broad surface catch while retaining optical softness.',
    40,
    '{"automaticMaterialBehavior":false,"glassAbsorption":42,"glassDiffusion":12,"glassDepth":64,"lensTransmission":0.3,"reflectionEnabled":true,"reflectionOpacity":0.3,"reflectionStrength":0.58,"reflectionBlur":0.68,"reflectionScale":1.24,"reflectionOffsetX":-6,"reflectionOffsetY":-12,"internalReflectionEnabled":true,"internalReflectionOpacity":0.03,"internalReflectionSoftness":0.84,"internalReflectionScale":0.88,"internalReflectionAngle":332,"fresnelEnabled":true,"fresnelStrength":0.16,"fresnelWidth":0.2,"fresnelSoftness":0.7,"edgeDensity":0.28,"edgeSoftness":0.6,"edgeOpacity":0.34}'::jsonb
  ),
  (
    'gradient',
    'Gradient',
    'Soft internal depth and feathered edges for gradient tint materials.',
    50,
    '{"automaticMaterialBehavior":false,"glassAbsorption":24,"glassDiffusion":26,"glassDepth":48,"lensTransmission":0.58,"reflectionEnabled":true,"reflectionOpacity":0.13,"reflectionStrength":0.38,"reflectionBlur":0.82,"reflectionScale":1.14,"reflectionOffsetX":-11,"reflectionOffsetY":-9,"internalReflectionEnabled":true,"internalReflectionOpacity":0.045,"internalReflectionSoftness":0.9,"internalReflectionScale":1.06,"internalReflectionAngle":342,"fresnelEnabled":true,"fresnelStrength":0.1,"fresnelWidth":0.16,"fresnelSoftness":0.78,"edgeDensity":0.16,"edgeSoftness":0.76,"edgeOpacity":0.2,"gradientEnabled":true,"gradientStrength":0.42}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  settings = EXCLUDED.settings,
  display_order = EXCLUDED.display_order,
  is_active = TRUE,
  updated_at = now();

COMMENT ON TABLE public.lens_material_profiles IS
  'Reusable copy-only starting points for optical lens settings; not an inheritance tier.';

COMMIT;
