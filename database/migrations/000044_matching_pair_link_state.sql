-- Matching pair link / active bracelet editing state (UI-only interaction prefs).
BEGIN;

ALTER TABLE public.bracelet_configurations
  ADD COLUMN IF NOT EXISTS matching_pair_linked BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS active_bracelet TEXT NOT NULL DEFAULT 'A'
    CHECK (active_bracelet IN ('A', 'B'));

COMMENT ON COLUMN public.bracelet_configurations.matching_pair_linked IS
  'When twinning is enabled: TRUE = linked editing (fill A then B); FALSE = independent strands';
COMMENT ON COLUMN public.bracelet_configurations.active_bracelet IS
  'Active strand for library placement when matching_pair_linked is FALSE';

COMMIT;
