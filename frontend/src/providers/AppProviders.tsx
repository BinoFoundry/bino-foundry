import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthModal } from "@/features/account/components/AuthModal";
import { AuthProvider } from "@/state/auth/AuthProvider";
import { RenderProvider } from "@/render/RenderProvider";
import { CatalogueProvider } from "@/state/catalogue";
import { SunglassesCatalogProvider } from "@/state/sunglasses-catalog";

import { createAppQueryClient } from "./query-client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CatalogueProvider>
            <SunglassesCatalogProvider>
              <RenderProvider>
                <TooltipProvider>
                  {children}
                  <AuthModal />
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </RenderProvider>
            </SunglassesCatalogProvider>
          </CatalogueProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
