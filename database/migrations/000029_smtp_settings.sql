-- Outbound SMTP configuration (singleton row, credentials encrypted at application layer).
BEGIN;

CREATE TABLE public.smtp_settings (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active             BOOLEAN NOT NULL DEFAULT false,
  host                  TEXT NOT NULL DEFAULT '',
  port                  INTEGER NOT NULL DEFAULT 587 CHECK (port > 0 AND port <= 65535),
  encryption            TEXT NOT NULL DEFAULT 'starttls'
    CHECK (encryption IN ('none', 'ssl', 'tls', 'starttls')),
  username_ciphertext   TEXT,
  password_ciphertext TEXT,
  from_name             TEXT NOT NULL DEFAULT '',
  from_email            TEXT NOT NULL DEFAULT '',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.smtp_settings IS
  'Singleton outbound mail configuration. Username and password encrypted by the API before storage.';

INSERT INTO public.smtp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

COMMIT;
