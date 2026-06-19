export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/** Load image for canvas processing — falls back to fetch+blob when CORS blocks direct load. */
export async function loadImageForProcessing(url: string): Promise<HTMLImageElement> {
  try {
    const img = await loadImage(url);
    return img;
  } catch {
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      throw new Error("Failed to load image");
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image for processing");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
