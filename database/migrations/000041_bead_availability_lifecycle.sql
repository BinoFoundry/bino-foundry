-- Bead availability lifecycle (database-driven statuses + force-delete support)

CREATE TABLE IF NOT EXISTS public.bead_availability_statuses (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  show_in_builder BOOLEAN NOT NULL DEFAULT false,
  allow_new_designs BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.bead_availability_statuses (
  code, label, description, show_in_builder, allow_new_designs, display_order
) VALUES
  (
    'ACTIVE',
    'Active',
    'Visible in the builder and available for new designs.',
    true,
    true,
    0
  ),
  (
    'INACTIVE',
    'Inactive',
    'Hidden from the builder; preserved in saved designs.',
    false,
    false,
    10
  ),
  (
    'COMING_SOON',
    'Coming Soon',
    'Not yet available in the builder.',
    false,
    false,
    20
  ),
  (
    'OUT_OF_STOCK',
    'Out of Stock',
    'Temporarily unavailable for new designs.',
    false,
    false,
    30
  ),
  (
    'DISCONTINUED',
    'Discontinued',
    'No longer offered for new designs.',
    false,
    false,
    40
  ),
  (
    'ARCHIVED',
    'Archived',
    'Retired from the catalogue.',
    false,
    false,
    50
  )
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.bead_libraries
  ADD COLUMN IF NOT EXISTS availability_status_code TEXT NOT NULL DEFAULT 'ACTIVE'
  REFERENCES public.bead_availability_statuses(code);

UPDATE public.bead_libraries
SET availability_status_code = CASE
  WHEN is_active = false THEN 'INACTIVE'
  ELSE 'ACTIVE'
END;

-- Preserve bead public id on saved design items when the catalogue row is force-deleted
ALTER TABLE public.bracelet_configuration_items
  ADD COLUMN IF NOT EXISTS bead_library_public_id_snapshot TEXT;

UPDATE public.bracelet_configuration_items ci
SET bead_library_public_id_snapshot = bl.public_id
FROM public.bead_libraries bl
WHERE ci.bead_library_id = bl.id
  AND ci.bead_library_public_id_snapshot IS NULL;

ALTER TABLE public.bracelet_configuration_items
  ALTER COLUMN bead_library_id DROP NOT NULL,
  ALTER COLUMN bead_library_size_id DROP NOT NULL;

ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_bead_library_id_fkey;

ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_bead_library_id_fkey
  FOREIGN KEY (bead_library_id) REFERENCES public.bead_libraries(id) ON DELETE SET NULL;

ALTER TABLE public.bracelet_configuration_items
  DROP CONSTRAINT IF EXISTS bracelet_configuration_items_bead_library_size_id_fkey;

ALTER TABLE public.bracelet_configuration_items
  ADD CONSTRAINT bracelet_configuration_items_bead_library_size_id_fkey
  FOREIGN KEY (bead_library_size_id) REFERENCES public.bead_library_sizes(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_bead_library_is_active_from_status()
RETURNS TRIGGER AS $$
BEGIN
  SELECT show_in_builder INTO NEW.is_active
  FROM public.bead_availability_statuses
  WHERE code = NEW.availability_status_code;

  IF NEW.is_active IS NULL THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bead_library_sync_is_active ON public.bead_libraries;

CREATE TRIGGER bead_library_sync_is_active
  BEFORE INSERT OR UPDATE OF availability_status_code
  ON public.bead_libraries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bead_library_is_active_from_status();

-- Refresh is_active for existing rows
UPDATE public.bead_libraries bl
SET is_active = s.show_in_builder
FROM public.bead_availability_statuses s
WHERE s.code = bl.availability_status_code;

DROP POLICY IF EXISTS bead_libraries_public_read ON public.bead_libraries;

CREATE POLICY bead_libraries_public_read ON public.bead_libraries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bead_availability_statuses s
      WHERE s.code = bead_libraries.availability_status_code
        AND s.show_in_builder = true
    )
  );

GRANT SELECT ON public.bead_availability_statuses TO anon, authenticated;
