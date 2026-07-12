-- Global bracelet bead render calibration (uniform mm → pixel scale).
BEGIN;

UPDATE public.config_kv
SET value = value || jsonb_build_object('beadRenderCalibrationFactor', 0.78)
WHERE key = 'site.settings_v1';

COMMIT;
