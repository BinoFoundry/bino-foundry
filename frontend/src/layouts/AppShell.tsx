import { type ReactNode } from "react";

import { AnnouncementBar } from "./AnnouncementBar";
import { GlobalHeader } from "./GlobalHeader";
import type { AppModule } from "./types";

export interface AppShellProps {
  activeModule: AppModule;
  children: ReactNode;
}

/** Single global shell — one header, full-height main content. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="surface-page flex h-[100dvh] flex-col overflow-hidden">
      <AnnouncementBar />
      <GlobalHeader />
      <main className="layout-main relative min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

export { platformAreaForPath } from "./platform-navigation";
