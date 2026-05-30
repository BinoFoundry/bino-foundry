import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";
import { adminFieldClass } from "@/features/admin/components/admin-styles";
import { isApiError } from "@/services/api";
import { braceletApi } from "@/services/api/bracelet";
import type { BraceletPricingRules } from "@bino-foundry/shared/types";

function parseEditorJson(text: string): { ok: BraceletPricingRules } | { error: string } {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!raw || typeof raw !== "object") {
      return { error: "JSON must be an object" };
    }
    const o = raw as Record<string, unknown>;
    if (!o.sizeMultipliers || typeof o.sizeMultipliers !== "object") {
      return { error: "sizeMultipliers is required (object, keys = mm as strings)" };
    }
    if (!Array.isArray(o.sizePricedTypeSlugs) || o.sizePricedTypeSlugs.length === 0) {
      return { error: "sizePricedTypeSlugs must be a non-empty array of slugs" };
    }
    if (typeof o.currencyCode !== "string" || o.currencyCode.length !== 3) {
      return { error: "currencyCode must be a 3-letter code (e.g. USD)" };
    }
    for (const [k, v] of Object.entries(o.sizeMultipliers as Record<string, unknown>)) {
      if (typeof v !== "number" || v <= 0) {
        return { error: `sizeMultipliers["${k}"] must be a positive number` };
      }
    }
    for (const slug of o.sizePricedTypeSlugs) {
      if (typeof slug !== "string" || !slug.trim()) {
        return { error: "Each sizePricedTypeSlugs entry must be a non-empty string" };
      }
    }
    return {
      ok: {
        sizeMultipliers: o.sizeMultipliers as Record<string, number>,
        sizePricedTypeSlugs: o.sizePricedTypeSlugs as string[],
        currencyCode: (o.currencyCode as string).toUpperCase(),
      },
    };
  } catch {
    return { error: "Invalid JSON syntax" };
  }
}

export function BraceletPricingAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await braceletApi.getPricingRules();
      const { description: desc, ...rules } = data;
      setDescription(desc?.trim() || "");
      setJsonText(JSON.stringify(rules, null, 2));
      setValidationError(null);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to load pricing rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const parsed = parseEditorJson(jsonText);
    if ("error" in parsed) {
      setValidationError(parsed.error);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      const saved = await braceletApi.updatePricingRules({
        ...parsed.ok,
        description: description.trim(),
      });
      const { description: desc, ...rules } = saved;
      setDescription(desc?.trim() || "");
      setJsonText(JSON.stringify(rules, null, 2));
    } catch (err) {
      const msg = isApiError(err)
        ? err.details
          ? `${err.message}: ${JSON.stringify(err.details)}`
          : err.message
        : "Failed to save pricing rules";
      setValidationError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading bracelet pricing…" className="h-48" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} className="m-6" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h3 className="font-display text-base font-semibold">Bracelet pricing rules</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Stored in <code className="rounded bg-muted px-1 text-xs">config_kv.bracelet.pricing_v1</code>.
          Changes apply on the next builder pricing refresh.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Config note (stored in <code className="text-[10px]">config_kv.description</code>)
        </label>
        <textarea
          className={`${adminFieldClass()} min-h-[64px] text-sm`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Audit note for operators…"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">JSON</label>
        <textarea
          className={`${adminFieldClass()} min-h-[220px] font-mono text-xs`}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setValidationError(null);
          }}
          spellCheck={false}
        />
        {validationError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {validationError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={saving}>
          Reset
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </div>
  );
}
