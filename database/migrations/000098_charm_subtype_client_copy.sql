-- Enrich Charm hang-related sub-type display names + descriptions for clients.
-- Catalogue rows (dangling / drop / fixed / hanging) were admin-created — keep slug + id.
-- Only replace short default names; never overwrite custom client renames.
-- Only fill blank / generic descriptions.

-- dangling
UPDATE public.sub_bead_types
SET
  name = CASE
    WHEN lower(trim(name)) = 'dangling' THEN 'Dangling (on cord)'
    ELSE name
  END,
  description = CASE
    WHEN trim(coalesce(description, '')) = ''
      OR lower(trim(description)) IN (
        'default grouping for charm',
        'dangling',
        'hanging charm'
      )
    THEN 'Hanging ring sits on the cord (higher hang).'
    ELSE description
  END,
  updated_at = now()
WHERE lower(trim(slug)) = 'dangling';

-- hanging (alias of dangling height)
UPDATE public.sub_bead_types
SET
  name = CASE
    WHEN lower(trim(name)) = 'hanging' THEN 'Hanging (on cord)'
    ELSE name
  END,
  description = CASE
    WHEN trim(coalesce(description, '')) = ''
      OR lower(trim(description)) IN (
        'default grouping for charm',
        'hanging',
        'hanging charm'
      )
    THEN 'Hanging ring sits on the cord (higher hang). Same hang style as Dangling.'
    ELSE description
  END,
  updated_at = now()
WHERE lower(trim(slug)) = 'hanging';

-- drop
UPDATE public.sub_bead_types
SET
  name = CASE
    WHEN lower(trim(name)) = 'drop' THEN 'Drop (lower hang)'
    ELSE name
  END,
  description = CASE
    WHEN trim(coalesce(description, '')) = ''
      OR lower(trim(description)) IN (
        'default grouping for charm',
        'drop',
        'drop charm'
      )
    THEN 'Same hang style as Dangling, sits lower under the cord.'
    ELSE description
  END,
  updated_at = now()
WHERE lower(trim(slug)) = 'drop';

-- fixed
UPDATE public.sub_bead_types
SET
  name = CASE
    WHEN lower(trim(name)) = 'fixed' THEN 'Fixed (on strand)'
    ELSE name
  END,
  description = CASE
    WHEN trim(coalesce(description, '')) = ''
      OR lower(trim(description)) IN (
        'default grouping for charm',
        'fixed',
        'fixed charm'
      )
    THEN 'Sits on the strand (does not hang).'
    ELSE description
  END,
  updated_at = now()
WHERE lower(trim(slug)) = 'fixed';
