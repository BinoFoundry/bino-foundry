-- Backfill strand rendering defaults for bead types missing metadata.strandRender.
-- Smart slug-based presets mirror application inferStrandRenderBehaviorPreset (fallback: round bead).
BEGIN;

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'anchorPreset', 'loop',
    'anchorX', 0.5,
    'anchorY', 0.08,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'radial-upright',
    'rotationOffsetDeg', 0,
    'zPriority', 10,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', false
  )
)
WHERE (metadata->'strandRender') IS NULL
  AND slug IN ('charm', 'pendant', 'locket');

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 0.38,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'radial-upright',
    'rotationOffsetDeg', 0,
    'zPriority', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', true
  )
)
WHERE (metadata->'strandRender') IS NULL
  AND slug IN ('spacer', 'separator');

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 0.45,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'radial-upright',
    'rotationOffsetDeg', 0,
    'zPriority', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', true
  )
)
WHERE (metadata->'strandRender') IS NULL
  AND slug = 'connector';

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'tangent',
    'rotationOffsetDeg', 0,
    'zPriority', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', true,
    'preferStrandImageUrl', false
  )
)
WHERE (metadata->'strandRender') IS NULL
  AND (
    slug IN ('crystal', 'gemstone', 'accent', 'round-bead', 'bead', 'stone')
    OR (metadata->'renderDefaults'->>'shape') = 'circle'
  );

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'anchorPreset', 'loop',
    'anchorX', 0.5,
    'anchorY', 0.08,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'radial-upright',
    'rotationOffsetDeg', 0,
    'zPriority', 5,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', false,
    'preferStrandImageUrl', false
  )
)
WHERE (metadata->'strandRender') IS NULL
  AND (metadata->'renderDefaults'->>'shape') = 'rect';

-- Final fallback: round bead preset for any remaining unconfigured types.
UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
    'attachmentStyle', 'inline',
    'strandOccupancy', 1,
    'anchorPreset', 'center',
    'anchorX', 0.5,
    'anchorY', 0.5,
    'verticalOffset', 0,
    'visualScale', 1,
    'rotationMode', 'tangent',
    'rotationOffsetDeg', 0,
    'zPriority', 0,
    'collisionPadding', 0,
    'stringOcclusion', 1,
    'forceRoundFootprint', true,
    'preferStrandImageUrl', false
  )
)
WHERE (metadata->'strandRender') IS NULL;

-- Drop empty per-bead override shells — assets inherit from bead type.
UPDATE public.bead_libraries
SET metadata = metadata - 'strandRenderOverride' || jsonb_build_object('useTypeStrandDefaults', true)
WHERE metadata ? 'strandRenderOverride'
  AND metadata->'strandRenderOverride' = '{}'::jsonb;

COMMIT;
