-- Generic catalog availability (rename bead-specific table) + frames + sunglasses force-delete support

ALTER TABLE IF EXISTS public.bead_availability_statuses RENAME TO catalog_availability_statuses;

ALTER TABLE public.bead_libraries
  DROP CONSTRAINT IF EXISTS bead_libraries_availability_status_code_fkey;

ALTER TABLE public.bead_libraries
  ADD CONSTRAINT bead_libraries_availability_status_code_fkey
  FOREIGN KEY (availability_status_code) REFERENCES public.catalog_availability_statuses(code);

ALTER TABLE public.frames
  ADD COLUMN IF NOT EXISTS availability_status_code TEXT NOT NULL DEFAULT 'ACTIVE'
  REFERENCES public.catalog_availability_statuses(code);

UPDATE public.frames
SET availability_status_code = CASE
  WHEN is_active = false THEN 'INACTIVE'
  ELSE 'ACTIVE'
END;

ALTER TABLE public.sunglasses_configurations
  ADD COLUMN IF NOT EXISTS frame_id_snapshot UUID;

UPDATE public.sunglasses_configurations sc
SET frame_id_snapshot = sc.frame_id
WHERE sc.frame_id IS NOT NULL
  AND sc.frame_id_snapshot IS NULL;

ALTER TABLE public.sunglasses_configurations
  ALTER COLUMN frame_id DROP NOT NULL;

ALTER TABLE public.sunglasses_configurations
  DROP CONSTRAINT IF EXISTS sunglasses_configurations_frame_id_fkey;

ALTER TABLE public.sunglasses_configurations
  ADD CONSTRAINT sunglasses_configurations_frame_id_fkey
  FOREIGN KEY (frame_id) REFERENCES public.frames(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_frame_is_active_from_status()
RETURNS TRIGGER AS $$
BEGIN
  SELECT show_in_builder INTO NEW.is_active
  FROM public.catalog_availability_statuses
  WHERE code = NEW.availability_status_code;

  IF NEW.is_active IS NULL THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS frame_sync_is_active ON public.frames;

CREATE TRIGGER frame_sync_is_active
  BEFORE INSERT OR UPDATE OF availability_status_code
  ON public.frames
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_frame_is_active_from_status();

UPDATE public.frames f
SET is_active = s.show_in_builder
FROM public.catalog_availability_statuses s
WHERE s.code = f.availability_status_code;

DROP POLICY IF EXISTS frames_public_read ON public.frames;

CREATE POLICY frames_public_read ON public.frames
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.catalog_availability_statuses s
      WHERE s.code = frames.availability_status_code
        AND s.show_in_builder = true
    )
  );

GRANT SELECT ON public.catalog_availability_statuses TO anon, authenticated;

-- Point bead lifecycle triggers/policies at the renamed status table
CREATE OR REPLACE FUNCTION public.sync_bead_library_is_active_from_status()
RETURNS TRIGGER AS $$
BEGIN
  SELECT show_in_builder INTO NEW.is_active
  FROM public.catalog_availability_statuses
  WHERE code = NEW.availability_status_code;

  IF NEW.is_active IS NULL THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS bead_libraries_public_read ON public.bead_libraries;

CREATE POLICY bead_libraries_public_read ON public.bead_libraries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.catalog_availability_statuses s
      WHERE s.code = bead_libraries.availability_status_code
        AND s.show_in_builder = true
    )
  );
