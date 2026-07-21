-- Fully synthetic lens rendering. The original lens image now contributes SHAPE ONLY: it is
-- knocked out of the plate and never sampled for colour or density inside the clip. The lens
-- colour comes entirely from the selected catalogue tint, so identical tints render identically
-- across frames regardless of the original lens asset colour/brightness. No blend modes
-- (multiply/overlay/screen/soft-light/hard-light/difference/luminosity) are used against the
-- original pixels. Adds four render controls; storage is unchanged (clip_config.render JSONB).
--   backgroundVisibility (0-1)     Global transparency; reveals the scene behind the lens
--                                   (the transparent knocked-out opening), never original texture.
--   environmentTransparency (0-1)  Thins the coloured body so the background shows through the tint.
--   centerDensity (0-1)            Density reinforcement toward the lens centre. Independent of tint.
--   edgeDensity (0-1)              Outer-edge thickness darkening. Independent of tint opacity.
-- Missing values preserve renderer defaults. No columns changed.

COMMENT ON COLUMN public.frame_render_views.clip_config IS
  'LensClipConfig v1 JSON per view. Original lens image is used as a clipping shape only; its colour is discarded (no blend modes against source pixels). Lens is painted synthetically from the selected tint. Optional render { renderScope: global|front|side, tintLayerOpacity, lensOpacity, reflectionOpacity, edgeDarkness, backgroundVisibility, environmentTransparency, centerDensity, edgeDensity }. Missing values preserve renderer defaults (tintLayerOpacity 0.42978, lensOpacity 0.9, reflectionOpacity 0.2, edgeDarkness 0.24, backgroundVisibility 0, environmentTransparency 0, centerDensity 0, edgeDensity 0.18).';
