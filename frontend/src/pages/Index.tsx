import { lazy, Suspense, useCallback } from "react";
import { useLocation } from "react-router-dom";

import AdvancedSunglassesBuilder from "@/components/AdvancedSunglassesBuilder";
import BraceletBuilder from "@/components/BraceletBuilder";
import { ErrorState, LoadingState } from "@/components/common";
import { AdminRouteGuard } from "@/features/auth/AdminRouteGuard";
import { UnavailableRedirect } from "@/features/auth/UnavailableRedirect";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { AppShell, BuilderViewport, type AppModule } from "@/layouts";
import { useAuth } from "@/state/auth/AuthProvider";
import { useCatalogue } from "@/state/catalogue";
import NotFound from "./NotFound";

const AdminApp = lazy(() =>
  import("@/features/admin").then((m) => ({ default: m.AdminApp })),
);

function resolveModule(pathname: string): AppModule | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/bracelet") return "bracelet";
  if (pathname === "/sunglasses") return "sunglasses";
  return null;
}

const Index = () => {
  const { pathname } = useLocation();
  const activeModule = resolveModule(pathname);
  const catalogue = useCatalogue();
  const { user, isLoading: authLoading, hasPermission } = useAuth();
  const onBraceletPriceChange = useCallback((_p: number) => {}, []);
  const onSunglassesPriceChange = useCallback((_p: number) => {}, []);

  if (!activeModule) {
    return <NotFound />;
  }

  if (activeModule === "admin") {
    if (authLoading) {
      return <LoadingState label="Loading…" className="h-full min-h-[100dvh]" />;
    }
    if (!user || !hasPermission("admin.access")) {
      return <UnavailableRedirect to={user ? "/account" : "/bracelet"} />;
    }
  }

  return (
    <AppShell activeModule={activeModule}>
      {catalogue.isHydrating && catalogue.beadLibraries.length === 0 && catalogue.frames.length === 0 ? (
        <LoadingState label="Loading catalogue…" className="h-full" />
      ) : catalogue.hydrateError ? (
        <ErrorState
          message={CUSTOMER_COPY.catalogueLoadFailed}
          onRetry={() => void catalogue.refreshFromApi()}
          className="m-6"
        />
      ) : (
        <BuilderViewport
          activeModule={activeModule}
          bracelet={<BraceletBuilder onPriceChange={onBraceletPriceChange} />}
          sunglasses={<AdvancedSunglassesBuilder onPriceChange={onSunglassesPriceChange} />}
          admin={
            <AdminRouteGuard>
              <Suspense fallback={<LoadingState label="Loading…" className="h-full" />}>
                <AdminApp />
              </Suspense>
            </AdminRouteGuard>
          }
        />
      )}
    </AppShell>
  );
};

export default Index;
