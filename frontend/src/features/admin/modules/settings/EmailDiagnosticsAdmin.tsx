import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, XCircle } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/common";
import { adminSettingsApi } from "@/services/api/admin-settings";
import { isApiError } from "@/services/api";
import type { EmailDiagnostics } from "@bino-foundry/shared/types";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function LogRow({ label, entry }: { label: string; entry: EmailDiagnostics["lastEmailSent"] }) {
  if (!entry) {
    return (
      <p className="text-sm text-muted-foreground">
        {label}: <span className="text-foreground">None recorded</span>
      </p>
    );
  }

  const tone = entry.status === "sent" ? "text-status-success" : "text-destructive";
  return (
    <div className="text-sm">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        {entry.emailType} → {entry.recipient} · {formatWhen(entry.createdAt)}
      </p>
      <p className={tone}>
        {entry.status === "sent" ? entry.smtpResponse ?? "Sent" : entry.failureReason ?? "Failed"}
      </p>
    </div>
  );
}

export function EmailDiagnosticsAdmin({ onRegisterReload }: { onRegisterReload?: (reload: () => Promise<void>) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmailDiagnostics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminSettingsApi.getEmailDiagnostics());
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load email diagnostics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onRegisterReload?.(load);
  }, [load, onRegisterReload]);

  if (loading) {
    return <LoadingState label="Loading email diagnostics…" className="h-32" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} className="m-0" />;
  }

  if (!data) return null;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h4 className="type-h3 text-base">Email diagnostics</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Delivery status for authentication and platform email. All sends use the active SMTP configuration.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SMTP status</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
            {data.smtpActive ? (
              <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" aria-hidden />
            )}
            {data.smtpActive ? "Active" : "Inactive or not configured"}
          </p>
          {data.smtpHost ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {data.smtpHost}
              {data.smtpFromEmail ? ` · ${data.smtpFromEmail}` : ""}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last 24 hours</p>
          <p className="mt-1 text-sm text-foreground">
            {data.stats.last24h.sent} sent · {data.stats.last24h.failed} failed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verification {data.stats.verification.sent}/{data.stats.verification.failed} · Reset{" "}
            {data.stats.passwordReset.sent}/{data.stats.passwordReset.failed}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Credential storage</p>
          <p className="mt-1 text-sm text-foreground">
            Username: {data.credentialStorage.username} · Password: {data.credentialStorage.password}
          </p>
          {data.credentialsNeedResave && data.credentialWarning ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{data.credentialWarning}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Encrypted at rest</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LogRow label="Last email sent" entry={data.lastEmailSent} />
        <LogRow label="Last email failure" entry={data.lastEmailFailure} />
      </div>

      {data.recentFailures.length > 0 ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            Recent failures
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {data.recentFailures.map((entry) => (
              <li key={entry.id}>
                <span className="text-foreground">{entry.emailType}</span> → {entry.recipient} ·{" "}
                {formatWhen(entry.createdAt)}
                {entry.failureReason ? ` — ${entry.failureReason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        No background queue is used — emails send immediately. Failed jobs appear above as failed log entries.
      </p>
    </section>
  );
}
