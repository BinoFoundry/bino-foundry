import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";
import { SITE_CURRENCY_OPTIONS } from "@/features/admin/constants/currency";
import { isApiError } from "@/services/api";
import { settingsApi } from "@/services/api/settings";
import { siteSettingsKeys } from "@/hooks/use-site-settings";
import { useQueryClient } from "@tanstack/react-query";

export function GeneralSettingsAdmin() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState("USD");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getGeneralSettings();
      setCurrencyCode(data.currencyCode || "USD");
      setValidationError(null);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load general settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setValidationError(null);
    setSaving(true);
    try {
      await settingsApi.updateGeneralSettings({
        currencyCode: currencyCode.toUpperCase(),
      });
      await queryClient.invalidateQueries({ queryKey: siteSettingsKeys.general() });
      toast.success("General settings saved");
    } catch (err) {
      const msg = isApiError(err)
        ? err.details
          ? `${err.message}: ${JSON.stringify(err.details)}`
          : err.message
        : "Failed to save general settings";
      setValidationError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading general settings…" className="h-48" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} className="m-6" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-4">
      <div>
        <h3 className="type-h3">General settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Site-wide defaults used across sunglasses and bracelet builders, saved configurations, and checkout
          display.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h4 className="type-body font-medium text-foreground">Currency</h4>
        <div className="flex flex-wrap gap-2">
          {SITE_CURRENCY_OPTIONS.map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant={currencyCode === code ? "default" : "outline"}
              onClick={() => setCurrencyCode(code)}
            >
              {code}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          All price labels and totals on the public site use this currency code.
        </p>
      </section>

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={saving}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
