-- Site-wide settings (currency, etc.) — single source for all builders.
BEGIN;

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'site.settings_v1',
  '{"currencyCode":"USD"}'::JSONB,
  'Site-wide general settings (currency for all builders and checkout)'
)
ON CONFLICT (key) DO NOTHING;

-- Prefer currency already stored on bracelet pricing rules when present.
UPDATE public.config_kv AS site
SET value = jsonb_set(
  site.value,
  '{currencyCode}',
  to_jsonb(
    COALESCE(
      bp.value->>'currencyCode',
      site.value->>'currencyCode',
      'USD'
    )
  )
)
FROM public.config_kv AS bp
WHERE site.key = 'site.settings_v1'
  AND bp.key = 'bracelet.pricing_v1'
  AND bp.value ? 'currencyCode';

COMMIT;
