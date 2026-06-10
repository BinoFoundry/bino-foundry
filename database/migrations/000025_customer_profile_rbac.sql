-- Customer profile fields + role cache for RBAC.
BEGIN;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'staff', 'admin', 'super_admin'));

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.customer_profiles.role IS 'Cached platform role; Supabase app/user metadata remains source of truth for admins';

COMMIT;
