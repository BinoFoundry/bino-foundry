-- Default platform currency: SGD (Singapore Dollar).
BEGIN;

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'site.settings_v1',
  '{"currencyCode":"SGD"}'::JSONB,
  'Site-wide general settings (currency for all builders and checkout)'
)
ON CONFLICT (key) DO NOTHING;

-- Existing installs that still use the legacy USD default move to SGD.
UPDATE public.config_kv
SET value = jsonb_set(value, '{currencyCode}', '"SGD"'::jsonb)
WHERE key = 'site.settings_v1'
  AND COALESCE(value->>'currencyCode', 'USD') = 'USD';

COMMIT;
