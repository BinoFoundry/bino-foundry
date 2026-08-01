import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthModal } from "@/features/account/components/AuthModal";
import { AuthProvider } from "@/state/auth/AuthProvider";
import { RenderProvider } from "@/render/RenderProvider";
import { CatalogueProvider } from "@/state/catalogue";
import { SunglassesCatalogProvider } from "@/state/sunglasses-catalog";

import { createAppQueryClient } from "./query-client";

/** App-wide providers for the data router layout route (`<Outlet />`). */
export function AppProviders({ children }: { children?: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CatalogueProvider>
          <SunglassesCatalogProvider>
            <RenderProvider>
              <TooltipProvider>
                {children ?? <Outlet />}
                <AuthModal />
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </RenderProvider>
          </SunglassesCatalogProvider>
        </CatalogueProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
