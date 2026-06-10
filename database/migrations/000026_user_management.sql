-- Account status, soft delete, and last login for admin user management.
BEGIN;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive', 'suspended'));

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_admin_list
  ON public.customer_profiles (deleted_at, role, account_status, created_at DESC);

COMMENT ON COLUMN public.customer_profiles.account_status IS 'active | inactive | suspended — enforced at API sign-in';
COMMENT ON COLUMN public.customer_profiles.deleted_at IS 'Soft delete timestamp; row retained for audit';
COMMENT ON COLUMN public.customer_profiles.last_login_at IS 'Updated on successful password sign-in';

COMMIT;
