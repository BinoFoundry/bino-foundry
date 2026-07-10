-- Global default bead orientation: face outward from bracelet centre.
BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object('orientationMode', 'outward')
WHERE key = 'bracelet.strand_render_defaults_v1';

COMMIT;
