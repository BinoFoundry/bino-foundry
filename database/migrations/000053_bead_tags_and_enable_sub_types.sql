-- Bead tags (many-to-many) + per-bead-type sub-type UI toggle.
-- Apply after 000052_how_we_prepare_options.sql.

BEGIN;

ALTER TABLE public.bead_types
  ADD COLUMN IF NOT EXISTS enable_sub_types BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bead_types.enable_sub_types IS
  'When true, builder shows sub-type underline tabs for this bead type';

-- Enable sub-types where the catalogue already has more than one active sub-type.
UPDATE public.bead_types bt
SET enable_sub_types = TRUE
WHERE (
  SELECT COUNT(*)::int
  FROM public.sub_bead_types sbt
  WHERE sbt.bead_type_id = bt.id AND sbt.is_active = TRUE
) > 1;

CREATE TABLE IF NOT EXISTS public.tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_trim CHECK (trim(name) <> ''),
  CONSTRAINT tags_slug_trim CHECK (trim(slug) <> ''),
  CONSTRAINT tags_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags (slug);

DROP TRIGGER IF EXISTS trg_tags_updated_at ON public.tags;
CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.tags IS 'Reusable bead catalogue tags (WordPress-style)';

CREATE TABLE IF NOT EXISTS public.bead_tags (
  bead_library_id UUID NOT NULL REFERENCES public.bead_libraries(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bead_library_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bead_tags_tag ON public.bead_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_bead_tags_bead ON public.bead_tags (bead_library_id);

COMMENT ON TABLE public.bead_tags IS 'Many-to-many: bead_libraries ↔ tags';

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bead_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_public_read ON public.tags;
CREATE POLICY tags_public_read ON public.tags FOR SELECT USING (true);

DROP POLICY IF EXISTS bead_tags_public_read ON public.bead_tags;
CREATE POLICY bead_tags_public_read ON public.bead_tags FOR SELECT USING (true);

COMMIT;
