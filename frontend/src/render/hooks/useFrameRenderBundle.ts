import { useCallback, useEffect, useState } from "react";

import { isApiFrameId, renderingApi } from "@/services/api/rendering";
import type { FrameRenderView } from "@/types/frame-rendering";

export function useFrameRenderBundle(frameId: string | undefined, localViews?: FrameRenderView[]) {
  const [views, setViews] = useState<FrameRenderView[]>(localViews ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!frameId) {
      setViews(localViews ?? []);
      return;
    }
    if (!isApiFrameId(frameId)) {
      setViews(localViews ?? []);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const bundle = await renderingApi.getBundle(frameId);
      setViews(bundle.views);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load render bundle");
      setViews(localViews ?? []);
    } finally {
      setLoading(false);
    }
  }, [frameId, localViews]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { views, setViews, loading, error, refresh };
}
