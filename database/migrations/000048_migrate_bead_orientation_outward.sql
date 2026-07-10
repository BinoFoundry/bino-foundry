-- Migrate existing catalogue rows from legacy inward defaults (rotationMode: tangent)
-- to explicit outward orientation. Preserves records with orientationMode already set.
BEGIN;

-- Bead types: stamp outward orientation where orientation was never explicitly configured.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  (COALESCE(metadata->'strandRender', '{}'::jsonb) - 'rotationMode')
    || jsonb_build_object('orientationMode', 'outward')
)
WHERE metadata->'strandRender'->>'orientationMode' IS NULL
  AND COALESCE(metadata->'strandRender'->>'rotationMode', 'tangent') NOT IN ('fixed-upright', 'none');

-- Sub bead types with custom strand overrides (not inheriting bead type).
UPDATE public.sub_bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRenderOverride}',
  (COALESCE(metadata->'strandRenderOverride', '{}'::jsonb) - 'rotationMode')
)
WHERE COALESCE((metadata->>'useBeadTypeStrandDefaults')::boolean, true) = false
  AND metadata ? 'strandRenderOverride'
  AND metadata->'strandRenderOverride'->>'orientationMode' IS NULL
  AND metadata->'strandRenderOverride'->>'rotationMode' = 'tangent';

-- Drop empty sub-type override shells after tangent removal.
UPDATE public.sub_bead_types
SET metadata = (metadata::jsonb - 'strandRenderOverride')
  || jsonb_build_object('useBeadTypeStrandDefaults', true)
WHERE metadata ? 'strandRenderOverride'
  AND metadata->'strandRenderOverride' = '{}'::jsonb;

-- Bead libraries with legacy tangent override (custom appearance, not inheriting sub-type).
UPDATE public.bead_libraries
SET metadata = jsonb_set(
  metadata,
  '{strandRenderOverride}',
  (COALESCE(metadata->'strandRenderOverride', '{}'::jsonb) - 'rotationMode')
)
WHERE COALESCE((metadata->>'useTypeStrandDefaults')::boolean, true) = false
  AND metadata ? 'strandRenderOverride'
  AND metadata->'strandRenderOverride'->>'orientationMode' IS NULL
  AND metadata->'strandRenderOverride'->>'rotationMode' = 'tangent';

-- Drop empty library override shells after tangent removal.
UPDATE public.bead_libraries
SET metadata = (metadata::jsonb - 'strandRenderOverride')
  || jsonb_build_object('useTypeStrandDefaults', true)
WHERE metadata ? 'strandRenderOverride'
  AND metadata->'strandRenderOverride' = '{}'::jsonb;

COMMIT;
