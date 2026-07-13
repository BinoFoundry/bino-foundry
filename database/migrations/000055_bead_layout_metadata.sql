-- Bead layout metadata: tight contact defaults, dangling charms, inline spacers.
BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object(
  'layoutMode', 'inline',
  'contactOffset', 0,
  'spacingAdjustment', 0
)
WHERE key = 'bracelet.strand_render_defaults_v1';

-- Round beads: full inline contact, edge-to-edge.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'layoutMode', 'inline',
    'contactWidth', 1,
    'leadingOverlap', 0,
    'trailingOverlap', 0,
    'contactOffset', 0,
    'spacingAdjustment', 0
  )
)
WHERE slug IN ('crystal', 'gemstone', 'accent', 'round-bead', 'bead', 'stone');

-- Spacers: inline full contact on their mm slot with slight junction tuck.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'layoutMode', 'inline',
    'contactWidth', 1,
    'leadingOverlap', 0.02,
    'trailingOverlap', 0.02,
    'contactOffset', 0,
    'spacingAdjustment', 0
  )
)
WHERE slug IN ('spacer', 'separator');

-- Dangling charms: attachment-point spacing only; ornament hangs below strand.
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender}',
  COALESCE(metadata->'strandRender', '{}'::jsonb) || jsonb_build_object(
    'layoutMode', 'dangling',
    'contactWidth', 0.08,
    'leadingOverlap', 0.03,
    'trailingOverlap', 0.03,
    'hangOffset', 0,
    'anchorPreset', 'loop',
    'anchorX', 0.5,
    'anchorY', 0.08,
    'rotationMode', 'radial-upright',
    'zPriority', 10
  )
)
WHERE slug IN ('charm', 'pendant', 'locket');

COMMIT;
