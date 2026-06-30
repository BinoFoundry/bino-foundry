-- Platform-wide strand rendering defaults (config_kv tier above bead_types.metadata.strandRender).
BEGIN;

INSERT INTO public.config_kv (key, value, description)
VALUES (
  'bracelet.strand_render_defaults_v1',
  jsonb_build_object(
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
  ),
  'Bracelet builder strand rendering system defaults (admin-editable)'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
