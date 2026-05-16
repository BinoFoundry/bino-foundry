import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createRenderEngineFacade } from "./facade";
import type { RenderFacade } from "./types";

const RenderContext = createContext<RenderFacade | null>(null);

export function RenderProvider({ children }: { children: ReactNode }) {
  const facade = useMemo(() => {
    const instance = createRenderEngineFacade();
    instance.init();
    return instance;
  }, []);

  return <RenderContext.Provider value={facade}>{children}</RenderContext.Provider>;
}

export function useRenderFacade(): RenderFacade {
  const ctx = useContext(RenderContext);
  if (!ctx) {
    throw new Error("useRenderFacade must be used within RenderProvider");
  }
  return ctx;
}
