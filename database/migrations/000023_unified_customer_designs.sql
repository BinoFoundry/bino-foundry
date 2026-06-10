-- Unified customer accounts: profiles, saved designs index, sunglasses configurations, orders prep.
BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id       UUID PRIMARY KEY,
  email         TEXT,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.customer_profiles IS 'Customer profile metadata keyed by Supabase Auth user id';

CREATE TABLE IF NOT EXISTS public.sunglasses_configurations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'saved'
                    CHECK (status IN ('draft', 'saved', 'ordered', 'archived')),
  owner_user_id     UUID,
  frame_id          UUID NOT NULL REFERENCES public.frames(id) ON DELETE RESTRICT,
  lens_tint_id      UUID NOT NULL REFERENCES public.sunglasses_lens_tints(id) ON DELETE RESTRICT,
  selected_options  JSONB NOT NULL DEFAULT '{}'::JSONB,
  builder_step      TEXT NOT NULL DEFAULT 'frame'
                    CHECK (builder_step IN ('frame', 'lens', 'rx', 'extras', 'preview')),
  currency_code     TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  subtotal          NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  order_reference   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sunglasses_configurations_public_id_trim CHECK (trim(public_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_sunglasses_configurations_owner
  ON public.sunglasses_configurations (owner_user_id, updated_at DESC);

CREATE TRIGGER trg_sunglasses_configurations_updated_at
  BEFORE UPDATE ON public.sunglasses_configurations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.sunglasses_configurations IS 'Saved sunglasses builder state (frame, tint, options, step)';

CREATE TABLE IF NOT EXISTS public.saved_designs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             TEXT NOT NULL UNIQUE,
  user_id               UUID NOT NULL,
  product_type          TEXT NOT NULL CHECK (product_type IN ('bracelet', 'sunglasses')),
  title                 TEXT,
  status                TEXT NOT NULL DEFAULT 'saved'
                        CHECK (status IN ('draft', 'saved', 'ordered', 'archived')),
  product_config_id     TEXT NOT NULL,
  subtotal              NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  currency_code         TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  preview_thumbnail_url TEXT,
  order_reference       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_designs_public_id_trim CHECK (trim(public_id) <> ''),
  CONSTRAINT saved_designs_product_config_trim CHECK (trim(product_config_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_saved_designs_user_updated
  ON public.saved_designs (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_designs_user_type
  ON public.saved_designs (user_id, product_type, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_designs_user_product_config
  ON public.saved_designs (user_id, product_config_id);

CREATE TRIGGER trg_saved_designs_updated_at
  BEFORE UPDATE ON public.saved_designs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.saved_designs IS 'Customer-facing saved design index across bracelet and sunglasses builders';

CREATE TABLE IF NOT EXISTS public.customer_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       TEXT NOT NULL UNIQUE,
  user_id         UUID NOT NULL,
  saved_design_id UUID REFERENCES public.saved_designs(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'cancelled')),
  total_amount    NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency_code   TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_orders_public_id_trim CHECK (trim(public_id) <> '')
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_user
  ON public.customer_orders (user_id, created_at DESC);

CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.customer_orders IS 'Customer checkout orders (checkout integration future-ready)';

ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunglasses_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_designs_owner_read ON public.saved_designs;
CREATE POLICY saved_designs_owner_read ON public.saved_designs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS sunglasses_configurations_owner_read ON public.sunglasses_configurations;
CREATE POLICY sunglasses_configurations_owner_read ON public.sunglasses_configurations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS customer_profiles_self_read ON public.customer_profiles;
CREATE POLICY customer_profiles_self_read ON public.customer_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS customer_orders_owner_read ON public.customer_orders;
CREATE POLICY customer_orders_owner_read ON public.customer_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMIT;
