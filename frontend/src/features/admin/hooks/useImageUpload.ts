import { useCallback, useState } from "react";

import { isApiError, uploadApi } from "@/services/api";

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPublic = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const data = await uploadApi.uploadImage(file);
      return data.imageUrl;
    } catch (err) {
      const message = isApiError(err) ? err.message : "Upload failed";
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const uploadStaging = useCallback(async (file: File, batch = "admin") => {
    setUploading(true);
    setError(null);
    try {
      return await uploadApi.uploadStaging(file, batch);
    } catch (err) {
      const message = isApiError(err) ? err.message : "Staging upload failed";
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploading, error, uploadPublic, uploadStaging, clearError: () => setError(null) };
}
