-- Sub bead types: second taxonomy tier between bead_types and bead_libraries.
BEGIN;

CREATE TABLE IF NOT EXISTS public.sub_bead_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bead_type_id  UUID NOT NULL REFERENCES public.bead_types(id) ON DELETE RESTRICT,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sub_bead_types_slug_trim CHECK (trim(slug) <> ''),
  CONSTRAINT sub_bead_types_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT sub_bead_types_slug_unique UNIQUE (bead_type_id, slug),
  CONSTRAINT sub_bead_types_name_unique UNIQUE (bead_type_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sub_bead_types_type_sort
  ON public.sub_bead_types (bead_type_id, is_active, display_order, name);

DROP TRIGGER IF EXISTS trg_sub_bead_types_updated_at ON public.sub_bead_types;
CREATE TRIGGER trg_sub_bead_types_updated_at
  BEFORE UPDATE ON public.sub_bead_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.sub_bead_types IS
  'Second-level bead taxonomy (e.g. Crystal → Quartz). Strand settings inherit from bead_types.';
COMMENT ON COLUMN public.sub_bead_types.metadata IS
  'Optional strandRenderOverride + useBeadTypeStrandDefaults inheritance flag';

-- Default sub-type per bead type for existing catalogue rows.
INSERT INTO public.sub_bead_types (bead_type_id, slug, name, description, display_order, metadata)
SELECT
  bt.id,
  bt.slug || '-general',
  'General',
  'Default grouping for ' || bt.name,
  0,
  '{"useBeadTypeStrandDefaults": true}'::JSONB
FROM public.bead_types bt
ON CONFLICT (bead_type_id, slug) DO NOTHING;

ALTER TABLE public.bead_libraries
  ADD COLUMN IF NOT EXISTS sub_bead_type_id UUID REFERENCES public.sub_bead_types(id) ON DELETE RESTRICT;

UPDATE public.bead_libraries bl
SET sub_bead_type_id = sbt.id
FROM public.sub_bead_types sbt
WHERE bl.sub_bead_type_id IS NULL
  AND sbt.bead_type_id = bl.bead_type_id
  AND sbt.slug = (
    SELECT bt.slug || '-general'
    FROM public.bead_types bt
    WHERE bt.id = bl.bead_type_id
  );

ALTER TABLE public.bead_libraries
  ALTER COLUMN sub_bead_type_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bead_libraries_sub_type
  ON public.bead_libraries (sub_bead_type_id);

-- Keep bead_type_id aligned with the sub-type parent.
CREATE OR REPLACE FUNCTION public.sync_bead_library_type_from_sub()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sub_bead_type_id IS NOT NULL THEN
    SELECT bead_type_id INTO NEW.bead_type_id
    FROM public.sub_bead_types
    WHERE id = NEW.sub_bead_type_id;
    IF NEW.bead_type_id IS NULL THEN
      RAISE EXCEPTION 'sub_bead_type_id % not found', NEW.sub_bead_type_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bead_libraries_sync_type_from_sub ON public.bead_libraries;
CREATE TRIGGER trg_bead_libraries_sync_type_from_sub
  BEFORE INSERT OR UPDATE OF sub_bead_type_id ON public.bead_libraries
  FOR EACH ROW EXECUTE FUNCTION public.sync_bead_library_type_from_sub();

-- Public read (builder catalogue).
ALTER TABLE public.sub_bead_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_bead_types_public_read ON public.sub_bead_types;
CREATE POLICY sub_bead_types_public_read ON public.sub_bead_types
  FOR SELECT
  USING (true);

COMMIT;
