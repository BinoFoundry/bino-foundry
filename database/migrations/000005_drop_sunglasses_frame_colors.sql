-- Remove sunglasses frame colour swatches (customiser feature retired).
BEGIN;

DROP TRIGGER IF EXISTS trg_sunglasses_frame_colors_updated_at ON public.sunglasses_frame_colors;
DROP INDEX IF EXISTS public.idx_sunglasses_frame_colors_active_sort;
DROP TABLE IF EXISTS public.sunglasses_frame_colors;

COMMIT;
