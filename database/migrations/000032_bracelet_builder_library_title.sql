-- Bracelet builder left sidebar title (admin-configurable copy).
BEGIN;

UPDATE public.config_kv
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{braceletBuilderLibraryTitle}',
  to_jsonb('Bead collection'::text),
  true
)
WHERE key = 'site.settings_v1'
  AND (value->>'braceletBuilderLibraryTitle' IS NULL OR trim(value->>'braceletBuilderLibraryTitle') = '');

COMMIT;
