-- Optional final optical balancing pass after physical strand placement.
-- When balanceSpacing is true (default), empty neighbour gaps are equalised while
-- occupancy, insertion order, and no-overlap rules stay intact.

BEGIN;

UPDATE public.config_kv
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('balanceSpacing', true),
    description = 'Bracelet builder strand rendering system defaults; balanceSpacing enables a final optical empty-gap balancing pass (default on)'
WHERE key = 'bracelet.strand_render_defaults_v1'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'balanceSpacing');

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'bracelet.strand_render_defaults_v1',
  jsonb_build_object('balanceSpacing', true),
  'Bracelet builder strand rendering system defaults; balanceSpacing enables a final optical empty-gap balancing pass (default on)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
