-- Polarised lenses are only offered in tints the admin marks available (typically grey).
-- Adds the per-tint flag and seeds the grey charcoal (2B2B2B) as eligible.

alter table sunglasses_lens_tints
  add column if not exists polarized_available boolean not null default false;

update sunglasses_lens_tints
  set polarized_available = true
  where lower(replace(gradient_top, '#', '')) = '2b2b2b';
