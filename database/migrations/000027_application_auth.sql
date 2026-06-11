-- Application-owned authentication: roles, users, sessions, and verification tokens.
-- Supabase Auth is no longer the identity source; Postgres tables are owned by the API.
BEGIN;

CREATE TABLE IF NOT EXISTS public.roles (
  id          SMALLSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.roles (id, name, code, description) VALUES
  (1, 'Admin', 'admin', 'Platform administrator'),
  (2, 'Customer', 'customer', 'Default customer role'),
  (3, 'Staff', 'staff', 'Internal staff member'),
  (4, 'Super Admin', 'super_admin', 'Full platform access')
ON CONFLICT (code) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.roles', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.roles), 4)
);

CREATE TABLE IF NOT EXISTS public.users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id           SMALLINT NOT NULL REFERENCES public.roles(id),
  full_name         TEXT,
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  phone_number      TEXT,
  avatar            TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended')),
  email_verified_at TIMESTAMPTZ,
  last_login_at     TIMESTAMPTZ,
  billing_details   JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active
  ON public.users (lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_admin_list
  ON public.users (deleted_at, role_id, status, created_at DESC);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.users IS 'Application-owned user accounts (credentials + profile)';
COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hash; migrated legacy users must reset password';

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  user_agent         TEXT,
  ip_address         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON public.user_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON public.password_reset_tokens (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON public.email_verification_tokens (user_id, expires_at DESC);

-- Migrate existing customer_profiles into application users (preserves UUIDs for saved designs / orders).
-- Migrated accounts receive a placeholder password hash and must use forgot-password before sign-in.
INSERT INTO public.users (
  id,
  role_id,
  full_name,
  email,
  password_hash,
  phone_number,
  status,
  email_verified_at,
  last_login_at,
  billing_details,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  cp.user_id,
  COALESCE(r.id, 2),
  cp.display_name,
  COALESCE(NULLIF(trim(cp.email), ''), cp.user_id::text || '@legacy.migrated'),
  '$2a$12$MIGRATION.REQUIRES.PASSWORD.RESET.VIA.FORGOT.PASSWORD',
  cp.phone,
  CASE cp.account_status
    WHEN 'suspended' THEN 'suspended'
    WHEN 'inactive' THEN 'inactive'
    ELSE 'active'
  END,
  NULL,
  cp.last_login_at,
  COALESCE(cp.billing_details, '{}'::JSONB),
  cp.created_at,
  cp.updated_at,
  cp.deleted_at
FROM public.customer_profiles cp
LEFT JOIN public.roles r ON r.code = cp.role
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = cp.user_id);

COMMIT;
