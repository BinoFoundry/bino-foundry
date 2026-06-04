-- M2: catalogue RLS (anon read-only) + bracelet owner / order prep
BEGIN;

-- ── Bracelet: optional owner + order reference ───────────────────────────────
ALTER TABLE public.bracelet_configurations
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS order_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_bracelet_configurations_owner
  ON public.bracelet_configurations (owner_user_id, updated_at DESC)
  WHERE owner_user_id IS NOT NULL;

COMMENT ON COLUMN public.bracelet_configurations.owner_user_id IS
  'Supabase Auth user id when saved with a Bearer JWT; null for anonymous/API-key saves';
COMMENT ON COLUMN public.bracelet_configurations.order_reference IS
  'External order id when status transitions to ordered (commerce prep)';

-- Relax bead size check to match API (4–24 mm) on saved items
ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_bead_size_mm_check;
ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_bead_size_mm_check
  CHECK (bead_size_mm >= 4 AND bead_size_mm <= 24);

ALTER TABLE public.bracelet_configurations
  DROP CONSTRAINT IF EXISTS bracelet_configurations_default_bead_size_mm_check;
ALTER TABLE public.bracelet_configurations
  ADD CONSTRAINT bracelet_configurations_default_bead_size_mm_check
  CHECK (default_bead_size_mm >= 4 AND default_bead_size_mm <= 24);

-- ── RLS: public read, no direct client writes (Express uses service role) ───
ALTER TABLE public.bead_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bead_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bead_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_lens_tints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunglasses_lens_tints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunglasses_builder_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_render_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracelet_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracelet_configuration_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_kv ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bead_types_public_read ON public.bead_types;
CREATE POLICY bead_types_public_read ON public.bead_types
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS bead_libraries_public_read ON public.bead_libraries;
CREATE POLICY bead_libraries_public_read ON public.bead_libraries
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS bead_sizes_public_read ON public.bead_sizes;
CREATE POLICY bead_sizes_public_read ON public.bead_sizes
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS frames_public_read ON public.frames;
CREATE POLICY frames_public_read ON public.frames
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- frame_lens_tints uses is_available (per-frame SKU tints), not is_active
DROP POLICY IF EXISTS frame_lens_tints_public_read ON public.frame_lens_tints;
CREATE POLICY frame_lens_tints_public_read ON public.frame_lens_tints
  FOR SELECT TO anon, authenticated
  USING (is_available = TRUE);

DROP POLICY IF EXISTS sunglasses_lens_tints_public_read ON public.sunglasses_lens_tints;
CREATE POLICY sunglasses_lens_tints_public_read ON public.sunglasses_lens_tints
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS sunglasses_builder_options_public_read ON public.sunglasses_builder_options;
CREATE POLICY sunglasses_builder_options_public_read ON public.sunglasses_builder_options
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS frame_render_views_public_read ON public.frame_render_views;
CREATE POLICY frame_render_views_public_read ON public.frame_render_views
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS config_kv_public_read ON public.config_kv;
CREATE POLICY config_kv_public_read ON public.config_kv
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS bracelet_configurations_public_read ON public.bracelet_configurations;
CREATE POLICY bracelet_configurations_public_read ON public.bracelet_configurations
  FOR SELECT TO anon, authenticated
  USING (status IN ('saved', 'ordered'));

DROP POLICY IF EXISTS bracelet_configuration_items_public_read ON public.bracelet_configuration_items;
CREATE POLICY bracelet_configuration_items_public_read ON public.bracelet_configuration_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bracelet_configurations c
      WHERE c.id = configuration_id
        AND c.status IN ('saved', 'ordered')
    )
  );

DROP POLICY IF EXISTS bracelet_configurations_owner_read ON public.bracelet_configurations;
CREATE POLICY bracelet_configurations_owner_read ON public.bracelet_configurations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

COMMIT;
