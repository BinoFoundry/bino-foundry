import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncBeadRenderCalibrationFromSettings } from "@/render/bead-crop/sync-bead-render-calibration";
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
import {
  notifyAdminSaveFailed,
  notifyAdminSavedEdit,
} from "@/features/admin/lib/admin-save-feedback";
import {
  ADMIN_UNSAVED_COPY,
  useDirtySnapshot,
  useUnsavedChangesGuard,
} from "@/features/admin/unsaved-changes";
import { siteSettingsKeys } from "@/hooks/use-site-settings";
import { isApiError } from "@/services/api";
import { settingsApi } from "@/services/api/settings";

interface GeneralSettingsAdminProps {
  /** When true, omit outer page chrome (used inside GeneralSettingsPage wrapper). */
  embedded?: boolean;
  onRegisterReload?: (reload: () => Promise<void>) => void;
}

export function GeneralSettingsAdmin({ embedded = false, onRegisterReload }: GeneralSettingsAdminProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_SITE_GENERAL_SETTINGS.currencyCode);
  const [braceletBuilderLibraryTitle, setBraceletBuilderLibraryTitle] = useState(
    DEFAULT_SITE_GENERAL_SETTINGS.braceletBuilderLibraryTitle,
  );
  const [beadRenderCalibrationFactor, setBeadRenderCalibrationFactor] = useState(
    DEFAULT_SITE_GENERAL_SETTINGS.beadRenderCalibrationFactor,
  );
  const [hydrateKey, setHydrateKey] = useState(0);

  const dirtySnapshot = useMemo(
    () => ({ currencyCode, braceletBuilderLibraryTitle, beadRenderCalibrationFactor }),
    [currencyCode, braceletBuilderLibraryTitle, beadRenderCalibrationFactor],
  );
  const { isDirty, markClean } = useDirtySnapshot(dirtySnapshot, hydrateKey);
  const { confirmLeave } = useUnsavedChangesGuard(!loading && isDirty);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsApi.getGeneralSettings();
      setCurrencyCode(data.currencyCode || DEFAULT_SITE_GENERAL_SETTINGS.currencyCode);
      setBraceletBuilderLibraryTitle(
        data.braceletBuilderLibraryTitle || DEFAULT_SITE_GENERAL_SETTINGS.braceletBuilderLibraryTitle,
      );
      setBeadRenderCalibrationFactor(
        data.beadRenderCalibrationFactor ?? DEFAULT_SITE_GENERAL_SETTINGS.beadRenderCalibrationFactor,
      );
      syncBeadRenderCalibrationFromSettings(data);
      setValidationError(null);
      setHydrateKey((k) => k + 1);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load general settings");
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

  const handleSave = async () => {
    setValidationError(null);
    setSaving(true);
    try {
      await settingsApi.updateGeneralSettings({
        currencyCode: currencyCode.toUpperCase(),
        braceletBuilderLibraryTitle: braceletBuilderLibraryTitle.trim(),
        beadRenderCalibrationFactor,
      });
      syncBeadRenderCalibrationFromSettings({ beadRenderCalibrationFactor });
      await queryClient.invalidateQueries({ queryKey: siteSettingsKeys.general() });
      notifyAdminSavedEdit();
      markClean();
    } catch (err) {
      notifyAdminSaveFailed(err, "Failed to save general settings");
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

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="bracelet-library-title">Bracelet builder library title</Label>
          <Input
            id="bracelet-library-title"
            value={braceletBuilderLibraryTitle}
            maxLength={80}
            onChange={(e) => setBraceletBuilderLibraryTitle(e.target.value)}
            placeholder="Bead collection"
          />
          <p className="text-xs text-muted-foreground">
            Heading shown in the left sidebar of the bracelet builder (e.g. &quot;Name Your Bracelet&quot;).
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="bead-render-calibration">Bracelet bead render calibration</Label>
          <Input
            id="bead-render-calibration"
            type="number"
            step="0.01"
            min={0.5}
            max={1.25}
            value={beadRenderCalibrationFactor}
            onChange={(e) => setBeadRenderCalibrationFactor(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Uniform mm→px baseline for all beads in the bracelet builder (database mm labels
            unchanged). Category and per-bead visual adjustments use{" "}
            <span className="font-medium">Render calibration</span> under Bracelet rendering
            defaults / Bead types / Sub-types / individual beads — that hierarchy does not change
            spacing or capacity.
          </p>
        </div>
      </section>

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {isDirty ? (
          <p className="mr-auto text-xs text-muted-foreground">{ADMIN_UNSAVED_COPY.status}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => confirmLeave(() => void load())}
          disabled={saving}
        >
          Reset
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
