-- Reset dangling / hanging Vertical offset from the old −25 baseline to 0,
-- and drop from the old 15 baseline to 12.
-- Hang is now driven by Layout (loop) + a catalogue-mm square; −25 fought that and
-- made identical parent settings look inconsistent across charms.
-- Only updates rows that still carry the old recommended values (does not overwrite custom tuning).

UPDATE public.sub_bead_types
SET
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{strandRenderOverride,verticalOffset}',
    '0'::jsonb,
    true
  ),
  updated_at = now()
WHERE lower(trim(slug)) IN ('dangling', 'hanging')
  AND (metadata -> 'strandRenderOverride' ->> 'verticalOffset')::numeric = -25;

UPDATE public.sub_bead_types
SET
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{strandRenderOverride,verticalOffset}',
    '12'::jsonb,
    true
  ),
  updated_at = now()
WHERE lower(trim(slug)) = 'drop'
  AND (metadata -> 'strandRenderOverride' ->> 'verticalOffset')::numeric = 15;
