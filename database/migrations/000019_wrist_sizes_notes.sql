-- Optional admin notes on wrist size catalog entries.
BEGIN;

ALTER TABLE public.wrist_sizes
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.wrist_sizes.notes IS 'Internal admin notes (not shown to customers)';

COMMIT;
