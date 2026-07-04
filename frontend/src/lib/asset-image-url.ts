/** Delivery tier for catalogue imagery — keeps PNG transparency without full-res downloads. */
export type AssetImageVariant = "thumbnail" | "medium" | "full";

const VARIANT_MAX_WIDTH: Record<Exclude<AssetImageVariant, "full">, number> = {
  thumbnail: 150,
  medium: 500,
};

const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_UPLOAD = "/upload/";

function isTransformableUrl(url: string): boolean {
  return !url.startsWith("data:") && !url.startsWith("blob:");
}

/** Insert or replace Cloudinary width transform (preserves transparency via f_auto). */
function cloudinarySizedUrl(url: string, maxWidth: number): string {
  const uploadIdx = url.indexOf(CLOUDINARY_UPLOAD);
  if (uploadIdx < 0) return url;

  const prefix = url.slice(0, uploadIdx + CLOUDINARY_UPLOAD.length);
  const suffix = url.slice(uploadIdx + CLOUDINARY_UPLOAD.length);

  const transform = `w_${maxWidth},c_limit,f_auto,q_auto`;
  const versionOrFolder = suffix.match(/^(v\d+\/|[^/]+\/)/);
  if (!versionOrFolder) return `${prefix}${transform}/${suffix}`;

  const rest = suffix.slice(versionOrFolder[0].length);
  const firstSegment = suffix.split("/")[0] ?? "";
  const looksLikeTransform =
    firstSegment.includes(",") ||
    /^(w_|h_|c_|f_|q_|g_|e_|b_|dpr_)/.test(firstSegment);

  if (looksLikeTransform) {
    const segments = suffix.split("/");
    segments[0] = transform;
    return prefix + segments.join("/");
  }

  return `${prefix}${transform}/${suffix}`;
}

/** Supabase image render endpoint — on-the-fly resize for public bucket objects. */
function supabaseRenderUrl(url: string, maxWidth: number): string | null {
  const match = url.match(/^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/);
  if (!match) return null;
  const [, origin, objectPath] = match;
  // format=origin preserves PNG/WebP alpha — default transform may flatten to JPEG (white background).
  return `${origin}/storage/v1/render/image/public/${objectPath}?width=${maxWidth}&quality=85&format=origin`;
}

/**
 * Resolve a display URL for the requested variant.
 * Full variant returns the source URL unchanged (admin editor, exports).
 */
export function resolveAssetImageUrl(
  url: string | null | undefined,
  variant: AssetImageVariant = "full",
): string | null {
  if (!url?.trim()) return null;
  const source = url.trim();
  if (variant === "full" || !isTransformableUrl(source)) return source;

  const maxWidth = VARIANT_MAX_WIDTH[variant];

  if (source.includes(CLOUDINARY_HOST)) {
    return cloudinarySizedUrl(source, maxWidth);
  }

  const supabase = supabaseRenderUrl(source, maxWidth);
  if (supabase) return supabase;

  return source;
}

/** Append a cache-buster without breaking existing query strings. */
export function withAssetCacheBuster(url: string, token = "2"): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${token}`;
}
