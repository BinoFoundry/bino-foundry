-- Per-tint render controls (opacity, gradient direction, intensity) for compositor + admin.
BEGIN;

ALTER TABLE public.sunglasses_lens_tints
  ADD COLUMN IF NOT EXISTS opacity NUMERIC(4, 3) NOT NULL DEFAULT 0.58
    CHECK (opacity >= 0.05 AND opacity <= 1),
  ADD COLUMN IF NOT EXISTS gradient_direction TEXT NOT NULL DEFAULT 'top-to-bottom'
    CHECK (gradient_direction IN ('top-to-bottom', 'bottom-to-top', 'left-to-right', 'right-to-left', 'custom')),
  ADD COLUMN IF NOT EXISTS gradient_angle SMALLINT NOT NULL DEFAULT 180
    CHECK (gradient_angle >= 0 AND gradient_angle < 360),
  ADD COLUMN IF NOT EXISTS gradient_mid_position SMALLINT NOT NULL DEFAULT 50
    CHECK (gradient_mid_position >= 0 AND gradient_mid_position <= 100),
  ADD COLUMN IF NOT EXISTS gradient_intensity NUMERIC(4, 3) NOT NULL DEFAULT 0.55
    CHECK (gradient_intensity >= 0 AND gradient_intensity <= 1);

COMMENT ON COLUMN public.sunglasses_lens_tints.opacity IS 'Lens tint overlay strength (0–1); used by SVG compositor';
COMMENT ON COLUMN public.sunglasses_lens_tints.gradient_direction IS 'Gradient axis preset or custom (use gradient_angle)';
COMMENT ON COLUMN public.sunglasses_lens_tints.gradient_mid_position IS 'Percent along axis where top/bottom colors blend';
COMMENT ON COLUMN public.sunglasses_lens_tints.gradient_intensity IS 'Transition sharpness 0=soft, 1=sharp';

COMMIT;
