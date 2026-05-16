import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";

import AdvancedSunglassesBuilder from "@/components/AdvancedSunglassesBuilder";
import BraceletBuilder from "@/components/BraceletBuilder";
import CatalogueAdmin from "@/components/admin/CatalogueAdmin";
import { ErrorState } from "@/components/common";
import { LoadingState } from "@/components/common";
import { AppShell, BuilderViewport, type AppModule } from "@/layouts";
import { useCatalogue } from "@/state/catalogue";

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
      {catalogue.isHydrating && catalogue.crystals.length === 0 && catalogue.frames.length === 0 ? (
        <LoadingState label="Loading catalogue…" className="h-full" />
      ) : catalogue.hydrateError ? (
        <ErrorState
          message={catalogue.hydrateError}
          onRetry={() => void catalogue.refreshFromApi()}
          className="m-6"
        />
      ) : (
        <BuilderViewport
          activeModule={activeModule}
          bracelet={<BraceletBuilder onPriceChange={onBraceletPriceChange} />}
          sunglasses={<AdvancedSunglassesBuilder onPriceChange={onSunglassesPriceChange} />}
          admin={<CatalogueAdmin />}
        />
      )}
    </AppShell>
  );
};

export default Index;
