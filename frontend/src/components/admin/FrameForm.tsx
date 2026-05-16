import { useState } from "react";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FrameEntry, LensColor } from "@/data/glasses";
import { isApiError, uploadApi } from "@/services/api";

interface FrameFormProps {
  initial?: FrameEntry;
  onSave: (entry: FrameEntry) => void;
  onCancel: () => void;
}

export const FrameForm = ({ initial, onSave, onCancel }: FrameFormProps) => {
  const blank: FrameEntry = {
    id: "", name: "", price: 0, description: "", frameImages: [], lensColors: []
  };
  const [form, setForm] = useState<FrameEntry>(initial ?? blank);
  const [images, setImages] = useState<string[]>(initial?.frameImages || []);
  const [lensColors, setLensColors] = useState<LensColor[]>(initial?.lensColors || []);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof FrameEntry, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addImage = () => setImages((prev) => [...prev, ""]);
  
  const updateImage = (index: number, value: string) => {
    const updated = [...images];
    updated[index] = value;
    setImages(updated);
  };
  
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addLensColor = () => setLensColors((prev) => [...prev, { colorName: "", image: "" }]);

  const updateLensColor = (index: number, field: keyof LensColor, value: string) => {
    const updated = [...lensColors];
    updated[index] = { ...updated[index], [field]: value };
    setLensColors(updated);
  };

  const removeLensColor = (index: number) => {
    setLensColors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await uploadApi.uploadImage(file);
      callback(data.imageUrl);
    } catch (err) {
      console.error(err);
      const msg = isApiError(err) ? err.message : "Failed to upload image. Please try again.";
      alert(msg);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ''; // trigger onChange again if needed
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = form.id || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    // Filter out empty images
    const validImages = images.filter(img => img.trim() !== "");
    const validLensColors = lensColors.filter(lc => lc.colorName.trim() !== "" && lc.image.trim() !== "");
    
    onSave({ ...form, id, frameImages: validImages, lensColors: validLensColors });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Frame Name *</label>
          <input
            autoFocus
            required
            className="w-full text-sm border border-border rounded p-2 bg-background focus:ring-1 focus:ring-primary outline-none"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Black Out"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Price</label>
          <input
            type="number"
            className="w-full text-sm border border-border rounded p-2 bg-background focus:ring-1 focus:ring-primary outline-none"
            value={form.price || ""}
            onChange={(e) => set("price", e.target.value ? parseFloat(e.target.value) : 0)}
            placeholder="e.g. 120"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <input
            className="w-full text-sm border border-border rounded p-2 bg-background focus:ring-1 focus:ring-primary outline-none"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Description..."
          />
        </div>
      </div>
      
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-foreground">Frame Images</label>
          <Button type="button" variant="outline" size="sm" onClick={addImage} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Add Image
          </Button>
        </div>
        <div className="space-y-3 pr-1 pb-1">
          {images.length === 0 && (
            <div className="text-xs text-muted-foreground italic text-center py-2">No images added.</div>
          )}
          {images.map((image, i) => (
            <div key={i} className="flex gap-2 items-center bg-muted/30 p-2 rounded border border-border">
              <div className="flex-1 flex items-center gap-3">
                {image ? (
                  <img src={image} alt={`Frame image ${i + 1}`} className="h-12 w-auto object-cover rounded bg-white/50" />
                ) : (
                  <span className="text-sm text-muted-foreground italic px-2">No image uploaded</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id={`upload-frame-image-${i}`}
                    onChange={(e) => handleUpload(e, (url) => updateImage(i, url))}
                  />
                  <label htmlFor={`upload-frame-image-${i}`} className="cursor-pointer bg-background border border-border rounded px-3 py-1.5 flex items-center gap-2 text-sm font-medium hover:bg-muted/80 transition-colors whitespace-nowrap" title="Upload Image">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload</span>
                  </label>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(i)} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-foreground">Frame Colors</label>
          <Button type="button" variant="outline" size="sm" onClick={addLensColor} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Add Color
          </Button>
        </div>
        <div className="space-y-3 pr-1 pb-1">
          {lensColors.length === 0 && (
            <div className="text-xs text-muted-foreground italic text-center py-2">No lens colors added.</div>
          )}
          {lensColors.map((lc, i) => (
            <div key={i} className="flex gap-2 items-center bg-muted/30 p-2 rounded border border-border">
              <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  className="w-full sm:w-1/3 text-sm border border-border rounded p-1.5 bg-background focus:ring-1 focus:ring-primary outline-none"
                  value={lc.colorName}
                  onChange={(e) => updateLensColor(i, "colorName", e.target.value)}
                  placeholder="e.g. Midnight Black"
                />
                {lc.image ? (
                  <img src={lc.image} alt={`Lens color ${i + 1}`} className="h-10 w-auto object-cover rounded bg-white/50" />
                ) : (
                  <span className="text-sm text-muted-foreground italic px-2">No image</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id={`upload-lens-image-${i}`}
                    onChange={(e) => handleUpload(e, (url) => updateLensColor(i, "image", url))}
                  />
                  <label htmlFor={`upload-lens-image-${i}`} className="cursor-pointer bg-background border border-border rounded px-3 py-1.5 flex items-center gap-2 text-sm font-medium hover:bg-muted/80 transition-colors whitespace-nowrap" title="Upload Image">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload</span>
                  </label>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLensColor(i)} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Frame</Button>
      </div>
    </form>
  );
};