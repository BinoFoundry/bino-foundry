-- Customer name (users.full_name) is mandatory platform-wide.
BEGIN;

UPDATE public.users
SET full_name = COALESCE(
  NULLIF(trim(full_name), ''),
  NULLIF(split_part(email, '@', 1), ''),
  'Customer'
)
WHERE full_name IS NULL OR trim(full_name) = '';

ALTER TABLE public.users
  ALTER COLUMN full_name SET NOT NULL;

COMMENT ON COLUMN public.users.full_name IS 'Customer display name (required)';

COMMIT;
