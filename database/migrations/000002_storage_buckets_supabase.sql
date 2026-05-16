-- Supabase Storage · buckets & read policies (run ONLY on Supabase projects)
-- Requires existing `storage` schema (provided by Supabase).
-- Applies after `000001_initial_catalog.sql` on the Postgres instance backing Storage.

BEGIN;

-- ── Buckets ─────────────────────────────────────────────────────────────────
-- Align bucket ids with `@bino-foundry/shared` STORAGE_BUCKET_IDS.
-- Public read: SPA/builders fetch hero images without JWT.
-- uploads: PRIVATE — backend service-role only for staging before promotion.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('frames', 'frames', TRUE, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]),
  ('crystals', 'crystals', TRUE, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]),
  ('assets', 'assets', TRUE, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]),
  ('uploads', 'uploads', FALSE, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Read policies for public catalogue buckets ───────────────────────────────
-- Writes stay on the backend with the SERVICE ROLE KEY (RLS bypass + no anon INSERT).
DROP POLICY IF EXISTS "catalogue_public_objects_select" ON storage.objects;

CREATE POLICY "catalogue_public_objects_select"
  ON storage.objects
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id IN ('frames', 'crystals', 'assets')
  );

-- uploads: intentional omission — anon/authenticated SELECT denied by default

COMMIT;
