-- Remove per-option price labels; currency display comes from global settings.

ALTER TABLE how_we_prepare_options
  DROP COLUMN IF EXISTS price_label;
