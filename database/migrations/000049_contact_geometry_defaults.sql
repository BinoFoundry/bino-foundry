-- Contact geometry defaults: layout spacing independent of bitmap dimensions.
BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object(
  'contactWidth', 1,
  'leadingOverlap', 0,
  'trailingOverlap', 0,
  'hangOffset', 0
)
WHERE key = 'bracelet.strand_render_defaults_v1';

-- Round beads: full contact width, no overlaps.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'contactWidth', 1,
    'leadingOverlap', 0,
    'trailingOverlap', 0,
    'hangOffset', 0
  )
)
WHERE COALESCE(metadata->'strandRender'->>'contactWidth', '') = ''
  AND (
    slug IN ('crystal', 'gemstone', 'accent', 'round-bead', 'bead', 'stone')
    OR COALESCE((metadata->'strandRender'->>'strandOccupancy')::numeric, 1) >= 0.99
  );

-- Spacers: thin contact + tuck overlaps so neighbours meet flush.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'contactWidth', 0.16,
    'leadingOverlap', 0.05,
    'trailingOverlap', 0.05,
    'hangOffset', 0
  )
)
WHERE COALESCE(metadata->'strandRender'->>'contactWidth', '') = ''
  AND slug IN ('spacer', 'separator');

-- Charms: minimal strand contact, small junction overlaps.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'contactWidth', 0.1,
    'leadingOverlap', 0.02,
    'trailingOverlap', 0.02,
    'hangOffset', 0
  )
)
WHERE COALESCE(metadata->'strandRender'->>'contactWidth', '') = ''
  AND slug IN ('charm', 'pendant', 'locket');

-- Connectors: narrow inline contact.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'contactWidth', 0.2,
    'leadingOverlap', 0.04,
    'trailingOverlap', 0.04,
    'hangOffset', 0
  )
)
WHERE COALESCE(metadata->'strandRender'->>'contactWidth', '') = ''
  AND slug = 'connector';

-- Remaining types without contactWidth: derive from legacy strandOccupancy.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'contactWidth', COALESCE((metadata->'strandRender'->>'strandOccupancy')::numeric, 1),
    'leadingOverlap', 0,
    'trailingOverlap', 0,
    'hangOffset', 0
  )
)
WHERE COALESCE(metadata->'strandRender'->>'contactWidth', '') = ''
  AND metadata ? 'strandRender';

COMMIT;
