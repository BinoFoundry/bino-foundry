-- Global bracelet contact-layout calibration.
-- Positioning only: never resizes source assets, rendered shells, or CSS imagery.
-- Existing business capacity remains nominal bead mm; the renderer derives tangent contact
-- diameter from bead metadata and applies layoutScale when positioning/collision-testing.

BEGIN;

UPDATE public.config_kv
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('layoutScale', 1),
    description = 'Bracelet builder strand rendering system defaults; layoutScale is global contact positioning calibration (1 = 100%, no image resize)'
WHERE key = 'bracelet.strand_render_defaults_v1'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'layoutScale');

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'bracelet.strand_render_defaults_v1',
  jsonb_build_object('layoutScale', 1),
  'Bracelet builder strand rendering system defaults; layoutScale is global contact positioning calibration (1 = 100%, no image resize)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
