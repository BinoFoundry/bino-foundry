-- Visual size scaling: power-curve exponent for catalogue mm → visual diameter.
-- 1 = linear. Values below 1 compress jumps between sizes while anchoring 6mm.
-- Occupancy / contact / layoutScale are unchanged — this is visual-only.

BEGIN;

UPDATE public.config_kv
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('visualSizeScaling', 0.7),
    description = 'Bracelet builder strand rendering system defaults; visualSizeScaling is the mm size-curve exponent (1 = linear, <1 = subtler size jumps; 6mm anchored)'
WHERE key = 'bracelet.strand_render_defaults_v1'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'visualSizeScaling');

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'bracelet.strand_render_defaults_v1',
  jsonb_build_object('visualSizeScaling', 0.7),
  'Bracelet builder strand rendering system defaults; visualSizeScaling is the mm size-curve exponent (1 = linear, <1 = subtler size jumps; 6mm anchored)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
