import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORTED_CURRENCIES,
  getCurrencyLabel,
} from "@/features/admin/constants/currency";
import { siteSettingsKeys } from "@/hooks/use-site-settings";
import { isApiError } from "@/services/api";
import { settingsApi } from "@/services/api/settings";

interface GeneralSettingsAdminProps {
  /** When true, omit outer page chrome (used inside GeneralSettingsPage wrapper). */
  embedded?: boolean;
}

export function GeneralSettingsAdmin({ embedded = false }: GeneralSettingsAdminProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_SITE_GENERAL_SETTINGS.currencyCode);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getGeneralSettings();
      setCurrencyCode(data.currencyCode || DEFAULT_SITE_GENERAL_SETTINGS.currencyCode);
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
    <div className={embedded ? "space-y-6" : "mx-auto max-w-2xl space-y-8 pb-4"}>
      {!embedded ? (
        <div>
          <h3 className="type-h3">General settings</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Site-wide defaults used across sunglasses and bracelet builders, saved configurations, and checkout
            display.
          </p>
        </div>
      ) : (
        <div>
          <h4 className="type-h3 text-base">General settings</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Site-wide defaults for currency and checkout display.
          </p>
        </div>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="site-currency">Default currency</Label>
          <Select value={currencyCode} onValueChange={setCurrencyCode}>
            <SelectTrigger id="site-currency" className="w-full">
              <SelectValue placeholder="Select currency">{getCurrencyLabel(currencyCode)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {getCurrencyLabel(currency.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the primary currency used for displaying prices throughout the website.
          </p>
        </div>
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
