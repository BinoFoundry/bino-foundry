import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import type { AppModule } from "./types";

interface BuilderViewportProps {
  activeModule: AppModule;
  bracelet: ReactNode;
  sunglasses: ReactNode;
  admin: ReactNode;
}

/** Keeps inactive builders mounted (state preserved) while showing one module. */
export function BuilderViewport({ activeModule, bracelet, sunglasses, admin }: BuilderViewportProps) {
  return (
    <div className="absolute inset-0">
      <ModulePane visible={activeModule === "bracelet"}>{bracelet}</ModulePane>
      <ModulePane visible={activeModule === "sunglasses"}>{sunglasses}</ModulePane>
      <ModulePane visible={activeModule === "admin"}>{admin}</ModulePane>
    </div>
  );
}

function ModulePane({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col",
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}
