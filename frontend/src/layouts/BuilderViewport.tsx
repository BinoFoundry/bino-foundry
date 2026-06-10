import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { AppModule } from "./types";

interface BuilderViewportProps {
  activeModule: AppModule;
  bracelet: ReactNode;
  sunglasses: ReactNode;
  admin: ReactNode;
}

/** Keeps inactive builders mounted (state preserved) while showing one module. */
export function BuilderViewport({ activeModule, bracelet, sunglasses, admin }: BuilderViewportProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeModule]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden pb-[env(safe-area-inset-bottom)]"
    >
      <ModulePane visible={activeModule === "bracelet"} label="Crystal bracelet builder">
        {bracelet}
      </ModulePane>
      <ModulePane visible={activeModule === "sunglasses"} label="Sunglasses customiser">
        {sunglasses}
      </ModulePane>
      {activeModule === "admin" ? (
        <ModulePane visible label="Admin dashboard">
          {admin}
        </ModulePane>
      ) : null}
    </div>
  );
}

function ModulePane({
  visible,
  label,
  children,
}: {
  visible: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col",
        visible
          ? "pointer-events-auto z-10 opacity-100"
          : "pointer-events-none invisible z-0 opacity-0",
      )}
      aria-hidden={!visible}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}
