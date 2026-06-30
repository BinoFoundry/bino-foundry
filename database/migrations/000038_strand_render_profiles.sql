-- Seed data-driven strand render profiles on bead types (renderer reads metadata.strandRender only).
BEGIN;

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
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
) WHERE slug IN ('crystal', 'gemstone', 'accent', 'round-bead');

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
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
) WHERE slug = 'charm';

UPDATE public.bead_types SET metadata = metadata || jsonb_build_object(
  'strandRender', jsonb_build_object(
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
) WHERE slug IN ('spacer', 'separator', 'connector');

COMMIT;
