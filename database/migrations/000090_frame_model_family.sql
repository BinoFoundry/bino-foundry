-- Frame model family — groups size variants of the same sunglasses model.
BEGIN;

ALTER TABLE public.frames
  ADD COLUMN IF NOT EXISTS model_family TEXT;

CREATE INDEX IF NOT EXISTS idx_frames_model_family
  ON public.frames (model_family)
  WHERE model_family IS NOT NULL AND trim(model_family) <> '';

COMMENT ON COLUMN public.frames.model_family IS
  'Optional product-family label (e.g. Aviator Classic). Shared look/preset and detail stamps across size SKUs.';

COMMIT;
