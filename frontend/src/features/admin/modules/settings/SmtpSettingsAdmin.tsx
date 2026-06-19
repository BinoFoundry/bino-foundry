import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { adminSettingsApi } from "@/services/api/admin-settings";
import { isApiError } from "@/services/api";
import type { SmtpEncryption, SmtpSettingsPublic, SmtpTemplateTestType } from "@bino-foundry/shared/types";
import { SMTP_ENCRYPTION_OPTIONS } from "@bino-foundry/shared/types";

const PASSWORD_PLACEHOLDER = "••••••••";

interface SmtpFormState {
  isActive: boolean;
  host: string;
  port: string;
  encryption: SmtpEncryption;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

function toFormState(data: SmtpSettingsPublic): SmtpFormState {
  return {
    isActive: data.isActive,
    host: data.host,
    port: String(data.port || 587),
    encryption: data.encryption,
    username: "",
    password: "",
    fromName: data.fromName,
    fromEmail: data.fromEmail,
  };
}

export function SmtpSettingsAdmin({ onRegisterReload }: { onRegisterReload?: (reload: () => Promise<void>) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTemplate, setTestingTemplate] = useState<SmtpTemplateTestType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [stored, setStored] = useState<SmtpSettingsPublic | null>(null);
  const [form, setForm] = useState<SmtpFormState>({
    isActive: false,
    host: "",
    port: "587",
    encryption: "starttls",
    username: "",
    password: "",
    fromName: "",
    fromEmail: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminSettingsApi.getSmtp();
      setStored(data);
      setForm(toFormState(data));
      setValidationError(null);
      setTestResult(null);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load SMTP settings");
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

  const setField = <K extends keyof SmtpFormState>(key: K, value: SmtpFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const buildUpdatePayload = () => ({
    isActive: form.isActive,
    host: form.host.trim(),
    port: Number(form.port),
    encryption: form.encryption,
    fromName: form.fromName.trim(),
    fromEmail: form.fromEmail.trim(),
    ...(form.username.trim() ? { username: form.username.trim() } : {}),
    ...(form.password ? { password: form.password } : {}),
  });

  const buildTestPayload = (templateType: SmtpTemplateTestType = "connection") => ({
    recipientEmail: testRecipient.trim(),
    templateType,
    useSaved: false as const,
    isActive: form.isActive,
    host: form.host.trim(),
    port: Number(form.port),
    encryption: form.encryption,
    fromName: form.fromName.trim(),
    fromEmail: form.fromEmail.trim(),
    ...(form.username.trim() ? { username: form.username.trim() } : {}),
    ...(form.password ? { password: form.password } : {}),
  });

  const handleTest = async (templateType: SmtpTemplateTestType = "connection") => {
    setValidationError(null);
    setTestResult(null);
    if (!testRecipient.trim()) {
      setValidationError("Enter a test recipient email address.");
      return;
    }

    setTestingTemplate(templateType);
    try {
      const result = await adminSettingsApi.testSmtpTemplate(buildTestPayload(templateType));
      setTestResult({ success: result.success, message: result.message });
      if (result.success) {
        toast.success(result.message);
      }
    } catch (err) {
      const msg = isApiError(err) ? err.message : "SMTP test failed";
      setTestResult({ success: false, message: msg });
    } finally {
      setTestingTemplate(null);
    }
  };

  const handleSave = async () => {
    setValidationError(null);
    setSaving(true);
    try {
      const updated = await adminSettingsApi.updateSmtp(buildUpdatePayload());
      setStored(updated);
      setForm(toFormState(updated));
      toast.success("SMTP settings saved");
    } catch (err) {
      const msg = isApiError(err)
        ? err.details
          ? `${err.message}: ${JSON.stringify(err.details)}`
          : err.message
        : "Failed to save SMTP settings";
      setValidationError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading SMTP settings…" className="h-48" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} className="m-6" />;
  }

  const usernamePlaceholder = stored?.usernameMasked ?? "smtp-user@example.com";
  const passwordPlaceholder = stored?.hasPassword ? PASSWORD_PLACEHOLDER : "Enter SMTP password";

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-4">
      <div>
        <h4 className="type-h3 text-base">SMTP configuration</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure outbound email for verification, password reset, and transactional messages.
          Credentials are encrypted before storage.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-3 py-3">
        <div>
          <Label htmlFor="smtp-active" className="font-medium text-foreground">
            Enable SMTP
          </Label>
          <p className="text-xs text-muted-foreground">Use these settings for platform email delivery.</p>
        </div>
        <Switch
          id="smtp-active"
          checked={form.isActive}
          onCheckedChange={(value) => setField("isActive", value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="smtp-host">SMTP host</Label>
          <Input
            id="smtp-host"
            value={form.host}
            onChange={(e) => setField("host", e.target.value)}
            placeholder="smtp.example.com"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-port">SMTP port</Label>
          <Input
            id="smtp-port"
            type="number"
            min={1}
            max={65535}
            value={form.port}
            onChange={(e) => setField("port", e.target.value)}
            placeholder="587"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-encryption">Encryption</Label>
          <Select value={form.encryption} onValueChange={(value) => setField("encryption", value as SmtpEncryption)}>
            <SelectTrigger id="smtp-encryption">
              <SelectValue placeholder="Select encryption" />
            </SelectTrigger>
            <SelectContent>
              {SMTP_ENCRYPTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-username">SMTP username</Label>
          <Input
            id="smtp-username"
            value={form.username}
            onChange={(e) => setField("username", e.target.value)}
            placeholder={usernamePlaceholder}
            autoComplete="off"
          />
          {stored?.usernameMasked ? (
            <p className="text-xs text-muted-foreground">Saved as {stored.usernameMasked}. Leave blank to keep.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-password">SMTP password</Label>
          <Input
            id="smtp-password"
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder={passwordPlaceholder}
            autoComplete="new-password"
          />
          {stored?.hasPassword ? (
            <p className="text-xs text-muted-foreground">Leave blank to keep the existing password.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-from-name">Sender name</Label>
          <Input
            id="smtp-from-name"
            value={form.fromName}
            onChange={(e) => setField("fromName", e.target.value)}
            placeholder="Bino Foundry"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-from-email">Sender email</Label>
          <Input
            id="smtp-from-email"
            type="email"
            value={form.fromEmail}
            onChange={(e) => setField("fromEmail", e.target.value)}
            placeholder="hello@example.com"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-3">
        <div className="space-y-2">
          <Label htmlFor="smtp-test-recipient">Test recipient email</Label>
          <Input
            id="smtp-test-recipient"
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="text-xs text-muted-foreground">
            Test delivery using the values above (inline). Registration and password reset use the saved active SMTP
            configuration — save settings before going live.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={testingTemplate !== null}
            onClick={() => void handleTest("connection")}
          >
            {testingTemplate === "connection" ? "Testing…" : "Test SMTP connection"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testingTemplate !== null}
            onClick={() => void handleTest("verification")}
          >
            {testingTemplate === "verification" ? "Sending…" : "Test verification email"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testingTemplate !== null}
            onClick={() => void handleTest("password_reset")}
          >
            {testingTemplate === "password_reset" ? "Sending…" : "Test password reset email"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testingTemplate !== null}
            onClick={() => void handleTest("notification")}
          >
            {testingTemplate === "notification" ? "Sending…" : "Test notification email"}
          </Button>
        </div>

        {testResult ? (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
              testResult.success
                ? "border border-success/30 bg-success-muted text-foreground"
                : "border border-destructive/30 bg-destructive/5 text-foreground"
            }`}
            role="status"
          >
            {testResult.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            )}
            <span>{testResult.message}</span>
          </div>
        ) : null}
      </div>

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={saving || testingTemplate !== null}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving || testingTemplate !== null}>
          {saving ? "Saving…" : "Save SMTP settings"}
        </Button>
      </div>
    </section>
  );
}
