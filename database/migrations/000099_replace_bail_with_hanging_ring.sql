-- Replace jewellery jargon "bail" with "hanging ring" in Charm sub-type client copy.
-- Safe if 000098 already wrote the old Bail wording; no-op when already updated.

UPDATE public.sub_bead_types
SET
  description = 'Hanging ring sits on the cord (higher hang).',
  updated_at = now()
WHERE lower(trim(slug)) = 'dangling'
  AND lower(trim(coalesce(description, ''))) = 'bail sits on the cord (higher hang).';

UPDATE public.sub_bead_types
SET
  description = 'Hanging ring sits on the cord (higher hang). Same hang style as Dangling.',
  updated_at = now()
WHERE lower(trim(slug)) = 'hanging'
  AND lower(trim(coalesce(description, ''))) =
    'bail sits on the cord (higher hang). same hang style as dangling.';
