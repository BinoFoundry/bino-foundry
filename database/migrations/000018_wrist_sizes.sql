-- Admin-managed wrist sizes for the bracelet builder (no hardcoded cm ranges).
BEGIN;

CREATE TABLE IF NOT EXISTS public.wrist_sizes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_cm           NUMERIC(4, 1) NOT NULL UNIQUE CHECK (size_cm > 0 AND size_cm <= 50),
  label             TEXT NOT NULL,
  display_order     INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wrist_sizes_label_trim CHECK (trim(label) <> '')
);

CREATE INDEX IF NOT EXISTS idx_wrist_sizes_active_sort
  ON public.wrist_sizes (is_active, display_order, size_cm);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wrist_sizes_single_default
  ON public.wrist_sizes (is_default) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_wrist_sizes_updated_at ON public.wrist_sizes;
CREATE TRIGGER trg_wrist_sizes_updated_at
  BEFORE UPDATE ON public.wrist_sizes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.wrist_sizes IS 'Bracelet builder wrist circumference options (cm); drives fit and canvas scale';

INSERT INTO public.wrist_sizes (size_cm, label, display_order, is_active, is_default) VALUES
  (14.0, '14 cm', 10, TRUE, FALSE),
  (15.0, '15 cm', 20, TRUE, FALSE),
  (16.0, '16 cm', 30, TRUE, TRUE),
  (17.0, '17 cm', 40, TRUE, FALSE),
  (18.0, '18 cm', 50, TRUE, FALSE),
  (19.0, '19 cm', 60, TRUE, FALSE)
ON CONFLICT (size_cm) DO NOTHING;

-- Relax saved-configuration wrist checks (values validated against wrist_sizes catalog in API).
ALTER TABLE public.bracelet_configurations
  DROP CONSTRAINT IF EXISTS bracelet_configurations_wrist_size_cm_a_check;
ALTER TABLE public.bracelet_configurations
  DROP CONSTRAINT IF EXISTS bracelet_configurations_wrist_size_cm_b_check;

ALTER TABLE public.bracelet_configurations
  ADD CONSTRAINT bracelet_configurations_wrist_size_cm_a_check
  CHECK (wrist_size_cm_a > 0 AND wrist_size_cm_a <= 50);
ALTER TABLE public.bracelet_configurations
  ADD CONSTRAINT bracelet_configurations_wrist_size_cm_b_check
  CHECK (wrist_size_cm_b > 0 AND wrist_size_cm_b <= 50);

ALTER TABLE public.wrist_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wrist_sizes_public_read ON public.wrist_sizes;
CREATE POLICY wrist_sizes_public_read ON public.wrist_sizes
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

COMMIT;
