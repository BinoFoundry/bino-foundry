-- Outbound email audit log for SMTP diagnostics and troubleshooting.
BEGIN;

CREATE TABLE public.email_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type      TEXT NOT NULL,
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  smtp_response   TEXT,
  failure_reason  TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_logs_created_at_idx ON public.email_logs (created_at DESC);
CREATE INDEX email_logs_email_type_idx ON public.email_logs (email_type);
CREATE INDEX email_logs_status_idx ON public.email_logs (status);

COMMENT ON TABLE public.email_logs IS
  'Audit trail for platform outbound email (auth, notifications, SMTP tests).';

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
