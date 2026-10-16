-- Refresh DIY Kit preparation copy: beads ship loose in a bag (no physical
-- sorting), a spare elastic, and a reusable DIY stringing tutorial. Drops the
-- redundant "Made to string together" highlight block.

BEGIN;

UPDATE public.how_we_prepare_options
SET
  short_description = 'Beads ship loose with elastic string and a stringing tutorial.',
  full_description  = 'Beads ship loose with elastic string and a spare, plus a DIY stringing tutorial.',
  benefits = '["Your selected crystals, charms and accessories", "Elastic string (plus a spare)", "A DIY stringing tutorial"]'::jsonb,
  highlight_title = '',
  highlight_description = ''
WHERE slug = 'diy-kit';

COMMIT;
