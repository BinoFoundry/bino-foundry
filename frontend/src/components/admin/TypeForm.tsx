import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TypeEntry } from "@/data/index";

interface TypeFormProps {
  initial?: TypeEntry;
  onSave: (entry: TypeEntry) => void;
  onCancel: () => void;
}

export const TypeForm = ({ initial, onSave, onCancel }: TypeFormProps) => {
  const blank: TypeEntry = {
    id: "", name: "", description: "",
  };
  const [form, setForm] = useState<TypeEntry>(initial ?? blank);

  const set = (k: keyof TypeEntry, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. gem, glass, metal..."
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Description of this type"
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body min-h-[80px]"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <Button variant="outline" type="button" onClick={onCancel} className="text-sm">Cancel</Button>
        <Button type="submit" className="text-sm bg-primary/90 hover:bg-primary">Save Type</Button>
      </div>
    </form>
  );
};
