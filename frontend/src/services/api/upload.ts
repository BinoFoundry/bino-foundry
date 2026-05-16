import { apiRequest } from "./client";

export interface CloudinaryUploadResult {
  imageUrl: string;
}

export interface StagingUploadResult {
  provider: string;
  bucket: string;
  objectKey: string;
  publicUrl?: string | null;
}

export const uploadApi = {
  /** Legacy Cloudinary multipart (`POST /upload`). */
  uploadImage(file: File, fieldName = "image"): Promise<CloudinaryUploadResult> {
    const form = new FormData();
    form.append(fieldName, file);
    return apiRequest<CloudinaryUploadResult>("/upload", {
      method: "POST",
      body: form,
      rawBody: true,
    });
  },

  /** Supabase staging bucket (`POST /upload/staging`). */
  uploadStaging(file: File, batch = "default"): Promise<StagingUploadResult> {
    const form = new FormData();
    form.append("image", file);
    return apiRequest<StagingUploadResult>(`/upload/staging?batch=${encodeURIComponent(batch)}`, {
      method: "POST",
      body: form,
      rawBody: true,
    });
  },
};
