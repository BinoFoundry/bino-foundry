import { lazy, Suspense, useCallback, useState } from "react";
import { useParams } from "react-router-dom";

import AdvancedSunglassesBuilder from "@/components/AdvancedSunglassesBuilder";
import BraceletBuilder from "@/components/BraceletBuilder";
import { ErrorState, LoadingState } from "@/components/common";
import { CUSTOMER_COPY } from "@/lib/customer-copy";
import { AppShell, BuilderViewport, type AppModule } from "@/layouts";
import { useCatalogue } from "@/state/catalogue";

const AdminApp = lazy(() =>
  import("@/features/admin").then((m) => ({ default: m.AdminApp })),
);

function parseModule(raw: string | undefined): AppModule {
  if (raw === "bracelet" || raw === "sunglasses" || raw === "admin") return raw;
  return "bracelet";
}

const Index = () => {
  const { module } = useParams<{ module: string }>();
  const activeModule = parseModule(module);
  const catalogue = useCatalogue();
  const [prices, setPrices] = useState({ bracelet: 0, sunglasses: 0 });

  const onBraceletPriceChange = useCallback((p: number) => {
    setPrices((prev) => (prev.bracelet === p ? prev : { ...prev, bracelet: p }));
  }, []);

  const onSunglassesPriceChange = useCallback((p: number) => {
    setPrices((prev) => (prev.sunglasses === p ? prev : { ...prev, sunglasses: p }));
  }, []);

  return (
    <AppShell
      activeModule={activeModule}
      braceletPrice={prices.bracelet}
      sunglassesPrice={prices.sunglasses}
    >
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
            <Suspense fallback={<LoadingState label="Loading admin…" className="h-full" />}>
              <AdminApp />
            </Suspense>
          }
        />
      )}
    </AppShell>
  );
};

export default Index;
