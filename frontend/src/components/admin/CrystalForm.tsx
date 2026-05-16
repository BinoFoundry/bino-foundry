import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatalogue } from "@/data/index";
import type { CrystalEntry } from "@/data/crystals";
import { isApiError, uploadApi } from "@/services/api";

// ── Crystal Form ─────────────────────────────────────────────────────────────

interface CrystalFormProps {
  initial?: CrystalEntry;
  onSave: (entry: CrystalEntry) => void;
  onCancel: () => void;
}

export const CrystalForm = ({ initial, onSave, onCancel }: CrystalFormProps) => {
  const cat = useCatalogue();
  const blank: CrystalEntry = {
    id: "", name: "", price: 1.00, image: "", type: "", description: "",
  };
  const [form, setForm] = useState<CrystalEntry>(initial ?? blank);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof CrystalEntry, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadApi.uploadImage(file);
      set("image", data.imageUrl);
    } catch (err) {
      console.error(err);
      const msg = isApiError(err) ? err.message : "Failed to upload image. Please try again.";
      alert(msg);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = form.id || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    onSave({ ...form, id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Turquoise"
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Price ($)</label>
          <input
            type="number" min={0} step={0.01}
            value={form.price}
            onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
          <select
            value={form.type ?? ""}
            onChange={(e) => set("type", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body"
          >
            <option value="">Select a type</option>
            {cat.types && cat.types.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Image</label>
          <div className="flex items-center gap-4 p-3 border border-border rounded-md bg-muted/20">
            <div className="relative w-16 h-16 rounded-md border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/50 hover:bg-muted focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all group cursor-pointer">
              {form.image ? (
                <img src={form.image} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground group-hover:scale-110 transition-transform" />
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {uploading ? "Uploading..." : "Upload image"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                PNG, JPG or SVG.
              </p>
              {form.image && (
                <button
                  type="button"
                  onClick={() => set("image", "")}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="Brief description of this crystal..."
            className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors font-body resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" variant="default" className="flex-1">
          {initial ? "Save Changes" : "Add Crystal"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
