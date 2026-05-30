import { useCallback, useRef, useState } from "react";
import { Copy, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { StagingUploadResult } from "@/services/api";

import { AdminEmptyState } from "../../components/AdminEmptyState";
import { AdminPage } from "../../components/AdminPage";
import { AdminToolbar } from "../../components/AdminToolbar";
import { useImageUpload } from "../../hooks/useImageUpload";

interface SessionUpload extends StagingUploadResult {
  fileName: string;
  uploadedAt: string;
}

export function MediaManagerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, error, uploadStaging, clearError } = useImageUpload();
  const [batch, setBatch] = useState("admin");
  const [session, setSession] = useState<SessionUpload[]>([]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      clearError();
      for (const file of Array.from(files)) {
        try {
          const result = await uploadStaging(file, batch.trim() || "admin");
          setSession((prev) => [
            {
              ...result,
              fileName: file.name,
              uploadedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          toast.success(`Uploaded ${file.name}`);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    },
    [batch, clearError, uploadStaging],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminToolbar hideSearch title={<span className="text-sm font-medium">Media library</span>} />
      <AdminPage>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Upload images to the staging bucket, then <strong>copy the public URL</strong> into frame or bead
          forms — or upload directly on those forms to write into the catalogue bucket. Both paths attach
          production-ready URLs to catalogue records.
        </p>

        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Batch name</span>
            <input
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-48 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
              placeholder="admin"
            />
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload to staging
          </Button>
        </div>

        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        {session.length === 0 ? (
          <AdminEmptyState message="No uploads in this session yet." />
        ) : (
          <ul className="space-y-2">
            {session.map((item) => (
              <li
                key={`${item.objectKey}-${item.uploadedAt}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{item.fileName}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{item.objectKey}</p>
                  {item.publicUrl ? (
                    <p className="truncate text-xs text-primary">{item.publicUrl}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const text = item.publicUrl ?? item.objectKey;
                    void navigator.clipboard.writeText(text);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy URL
                </Button>
              </li>
            ))}
          </ul>
        )}
      </AdminPage>
    </div>
  );
}
