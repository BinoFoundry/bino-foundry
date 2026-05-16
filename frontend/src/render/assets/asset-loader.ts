export type AssetLoadStatus = "idle" | "loading" | "loaded" | "error";

export interface LoadedImageAsset {
  url: string;
  status: AssetLoadStatus;
  element?: HTMLImageElement;
  error?: string;
}

/**
 * Lightweight image preload cache (swap-friendly vs Supabase/CDN URLs).
 */
export class AssetLoader {
  private cache = new Map<string, LoadedImageAsset>();

  get(url: string): LoadedImageAsset | undefined {
    return this.cache.get(url);
  }

  async preload(url: string): Promise<HTMLImageElement> {
    const existing = this.cache.get(url);
    if (existing?.status === "loaded" && existing.element) {
      return existing.element;
    }

    this.cache.set(url, { url, status: "loading" });

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.cache.set(url, { url, status: "loaded", element: img });
        resolve(img);
      };
      img.onerror = () => {
        const error = `Failed to load asset: ${url}`;
        this.cache.set(url, { url, status: "error", error });
        reject(new Error(error));
      };
      img.src = url;
    });
  }

  async preloadMany(urls: string[]): Promise<void> {
    await Promise.allSettled(urls.filter(Boolean).map((u) => this.preload(u)));
  }

  clear(): void {
    this.cache.clear();
  }
}
