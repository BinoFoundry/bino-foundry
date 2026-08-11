-- Remove zPriority from strand render calibration data.
-- Current strand preview stacking uses bead sequence order; zPriority is no longer part of the data model.
BEGIN;

-- Platform-wide defaults (config_kv)
UPDATE public.config_kv
SET value = value - 'zPriority'
WHERE value ? 'zPriority';

-- Bead type / sub-type strandRender payloads (bead_types.metadata.strandRender)
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) - 'zPriority'
)
WHERE metadata->'strandRender' ? 'zPriority';

-- Optional per-bead override payloads (bead_libraries.metadata.strandRenderOverride)
UPDATE public.bead_libraries
SET metadata = jsonb_set(
  metadata,
  '{strandRenderOverride}',
  COALESCE(metadata->'strandRenderOverride', '{}'::jsonb) - 'zPriority'
)
WHERE metadata->'strandRenderOverride' ? 'zPriority';

COMMIT;

