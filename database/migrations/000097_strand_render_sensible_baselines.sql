-- Establish sensible strand-render baselines without touching bead_libraries.
-- Idempotent:
--   * type keys: recommended || existing (existing keys always win)
--   * sub-types: replace ONLY when experimental fingerprint still matches
--   * never UPDATE bead_libraries

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) System defaults — fill missing keys only (existing value wins)
-- ---------------------------------------------------------------------------
UPDATE public.config_kv
SET
  value =
    jsonb_build_object(
      'layoutScale', 1,
      'balanceSpacing', true,
      'attachmentStyle', 'inline',
      'strandOccupancy', 1,
      'contactWidth', 1,
      'layoutMode', 'inline',
      'contactOffset', 0,
      'spacingAdjustment', 0,
      'leadingOverlap', 0,
      'trailingOverlap', 0,
      'hangOffset', 0,
      'anchorPreset', 'center',
      'anchorX', 0.5,
      'anchorY', 0.5,
      'verticalOffset', 0,
      'visualScale', 1,
      'visualSizeScaling', 0.7,
      'orientationMode', 'outward',
      'rotationMode', 'tangent',
      'rotationOffsetDeg', 0,
      'collisionPadding', 0,
      'stringOcclusion', 1,
      'forceRoundFootprint', true,
      'preferStrandImageUrl', false,
      'verticalOffsetUnit', 'percent'
    )
    || value,
  updated_at = now()
WHERE key = 'bracelet.strand_render_defaults_v1';

-- ---------------------------------------------------------------------------
-- 2) Bead types — fill missing strandRender keys (existing keys win)
-- ---------------------------------------------------------------------------

-- Crystal / accent / round-like
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'contactWidth', 1,
    'layoutMode', 'inline',
    'contactOffset', 0,
    'spacingAdjustment', 0,
    'leadingOverlap', 0,
    'trailingOverlap', 0,
    'hangOffset', 0,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'orientationMode', 'outward',
    'rotationMode', 'tangent',
    'rotationOffsetDeg', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', true,
    'preferStrandImageUrl', false,
    'verticalOffsetUnit', 'percent'
  ) || COALESCE(metadata->'strandRender', '{}'::jsonb),
  true
)
WHERE slug IN ('crystal', 'gemstone', 'accent', 'round-bead', 'bead', 'stone');

-- Charm / pendant / locket
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'contactWidth', 1,
    'layoutMode', 'dangling',
    'contactOffset', 0,
    'spacingAdjustment', 0,
    'leadingOverlap', 0.03,
    'trailingOverlap', 0.03,
    'hangOffset', 0,
    'anchorPreset', 'loop',
    'anchorX', 0.5,
    'anchorY', 0.08,
    'verticalOffset', 0,
    'visualScale', 1,
    'orientationMode', 'outward',
    'rotationMode', 'radial-upright',
    'rotationOffsetDeg', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', false,
    'verticalOffsetUnit', 'percent'
  ) || COALESCE(metadata->'strandRender', '{}'::jsonb),
  true
)
WHERE slug IN ('charm', 'pendant', 'locket');

-- Legacy charm verticalOffset fraction 0.25 → neutral 0 (sub-types own hang)
UPDATE public.bead_types
SET metadata = jsonb_set(
  metadata,
  '{strandRender,verticalOffset}',
  '0'::jsonb,
  true
)
WHERE slug = 'charm'
  AND COALESCE((metadata->'strandRender'->>'verticalOffset')::numeric, 0) = 0.25;

-- Spacer / separator
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'contactWidth', 1,
    'layoutMode', 'inline',
    'contactOffset', -0.15,
    'spacingAdjustment', 0,
    'leadingOverlap', 0.02,
    'trailingOverlap', 0.02,
    'hangOffset', 0,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'orientationMode', 'outward',
    'rotationMode', 'tangent',
    'rotationOffsetDeg', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', true,
    'verticalOffsetUnit', 'percent'
  ) || COALESCE(metadata->'strandRender', '{}'::jsonb),
  true
)
WHERE slug IN ('spacer', 'separator');

-- Connector
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'attachmentStyle', 'inline',
    'strandOccupancy', 0.45,
    'contactWidth', 0.45,
    'layoutMode', 'inline',
    'contactOffset', 0,
    'spacingAdjustment', 0,
    'leadingOverlap', 0.04,
    'trailingOverlap', 0.04,
    'hangOffset', 0,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'orientationMode', 'outward',
    'rotationMode', 'tangent',
    'rotationOffsetDeg', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', true,
    'verticalOffsetUnit', 'percent'
  ) || COALESCE(metadata->'strandRender', '{}'::jsonb),
  true
)
WHERE slug = 'connector';

-- Any remaining type still missing strandRender entirely
UPDATE public.bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRender}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'contactWidth', 1,
    'layoutMode', 'inline',
    'contactOffset', 0,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'orientationMode', 'outward',
    'rotationMode', 'tangent',
    'forceRoundFootprint', true,
    'verticalOffsetUnit', 'percent'
  ),
  true
)
WHERE (metadata->'strandRender') IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Sub-types — repair ONLY known experimental fingerprints
-- ---------------------------------------------------------------------------

-- crystal-general: layoutScale 0.4 + contactWidth 1.8 → inherit crystal type
UPDATE public.sub_bead_types
SET metadata =
  (COALESCE(metadata, '{}'::jsonb) - 'strandRenderOverride')
  || jsonb_build_object('useBeadTypeStrandDefaults', true)
WHERE slug = 'crystal-general'
  AND COALESCE((metadata->'strandRenderOverride'->>'layoutScale')::numeric, 0) = 0.4
  AND COALESCE((metadata->'strandRenderOverride'->>'contactWidth')::numeric, 0) = 1.8;

-- charm/fixed: visualScale 5 + layoutScale 0.2 → inline/center baseline
UPDATE public.sub_bead_types
SET metadata =
  COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'useBeadTypeStrandDefaults', false,
    'strandRenderOverride', jsonb_build_object(
      'layoutScale', 1,
      'balanceSpacing', true,
      'visualScale', 1,
      'contactWidth', 1,
      'contactOffset', 0,
      'layoutMode', 'inline',
      'verticalOffset', 0,
      'hangOffset', 0,
      'anchorPreset', 'center',
      'anchorX', 0.5,
      'anchorY', 0.5,
      'orientationMode', 'outward',
      'rotationMode', 'tangent',
      'forceRoundFootprint', false,
      'strandOccupancy', 1,
      'verticalOffsetUnit', 'percent'
    )
  )
WHERE slug = 'fixed'
  AND COALESCE((metadata->'strandRenderOverride'->>'visualScale')::numeric, 0) = 5
  AND COALESCE((metadata->'strandRenderOverride'->>'layoutScale')::numeric, 0) = 0.2;

-- charm/hanging: lone contactWidth -0.5 → dangling baseline
UPDATE public.sub_bead_types
SET metadata =
  COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'useBeadTypeStrandDefaults', false,
    'strandRenderOverride', jsonb_build_object(
      'layoutScale', 1,
      'balanceSpacing', true,
      'visualScale', 1,
      'contactWidth', 1,
      'contactOffset', 0,
      'layoutMode', 'dangling',
      'verticalOffset', -25,
      'hangOffset', 0,
      'anchorPreset', 'loop',
      'anchorX', 0.5,
      'anchorY', 0.08,
      'orientationMode', 'outward',
      'rotationMode', 'radial-upright',
      'forceRoundFootprint', false,
      'verticalOffsetUnit', 'percent'
    )
  )
WHERE slug = 'hanging'
  AND COALESCE((metadata->'strandRenderOverride'->>'contactWidth')::numeric, 0) = -0.5
  AND (
    SELECT count(*)::int
    FROM jsonb_object_keys(COALESCE(metadata->'strandRenderOverride', '{}'::jsonb)) AS k(key)
    WHERE k.key <> 'verticalOffsetUnit'
  ) <= 2;

-- charm/drop: center + layoutScale 0.8 → loop dangling baseline
UPDATE public.sub_bead_types
SET metadata =
  COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'useBeadTypeStrandDefaults', false,
    'strandRenderOverride', jsonb_build_object(
      'layoutScale', 1,
      'balanceSpacing', true,
      'visualScale', 1,
      'contactWidth', 1,
      'contactOffset', 0,
      'layoutMode', 'dangling',
      'verticalOffset', 15,
      'hangOffset', 0,
      'anchorPreset', 'loop',
      'anchorX', 0.5,
      'anchorY', 0.08,
      'orientationMode', 'outward',
      'rotationMode', 'radial-upright',
      'forceRoundFootprint', false,
      'verticalOffsetUnit', 'percent'
    )
  )
WHERE slug = 'drop'
  AND COALESCE(metadata->'strandRenderOverride'->>'anchorPreset', '') = 'center'
  AND COALESCE((metadata->'strandRenderOverride'->>'layoutScale')::numeric, 0) = 0.8;

-- dangling: already a sensible baseline — fill missing keys only
UPDATE public.sub_bead_types
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{strandRenderOverride}',
  jsonb_build_object(
    'layoutScale', 1,
    'balanceSpacing', true,
    'visualScale', 1,
    'contactWidth', 1,
    'contactOffset', 0,
    'layoutMode', 'dangling',
    'verticalOffset', -25,
    'hangOffset', 0,
    'anchorPreset', 'loop',
    'anchorX', 0.5,
    'anchorY', 0.08,
    'orientationMode', 'outward',
    'rotationMode', 'radial-upright',
    'forceRoundFootprint', false,
    'verticalOffsetUnit', 'percent'
  ) || COALESCE(metadata->'strandRenderOverride', '{}'::jsonb),
  true
)
WHERE slug = 'dangling'
  AND metadata ? 'strandRenderOverride';

COMMIT;
