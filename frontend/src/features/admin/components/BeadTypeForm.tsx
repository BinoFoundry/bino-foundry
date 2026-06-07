import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BeadTypeEntry } from "@/types/beads";

import { adminFieldClass } from "./admin-styles";

interface BeadTypeFormProps {
  initial?: BeadTypeEntry;
  onSave: (entry: BeadTypeEntry) => void | Promise<void>;
  onCancel: () => void;
}

export function BeadTypeForm({ initial, onSave, onCancel }: BeadTypeFormProps) {
  const blank: BeadTypeEntry = {
    id: "",
    slug: "",
    name: "",
    description: "",
    displayOrder: 0,
    isActive: true,
  };
  const [form, setForm] = useState<BeadTypeEntry>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
          <input
            required
            className={adminFieldClass()}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Crystal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            className={adminFieldClass()}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Display order</label>
            <input
              type="number"
              className={adminFieldClass()}
              value={form.displayOrder ?? 0}
              onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive !== false}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active in builder
          </label>
        </div>
        {initial?.slug ? (
          <p className="font-mono text-[10px] text-muted-foreground">Slug: {initial.slug}</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save type"}
        </Button>
      </div>
    </form>
  );
}
