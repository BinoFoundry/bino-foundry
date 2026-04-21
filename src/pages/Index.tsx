import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Gem, Glasses, Settings, Menu, X } from "lucide-react";
import LivePrice from "@/components/LivePrice";
import BraceletBuilder from "@/components/BraceletBuilder";
import AdvancedSunglassesBuilder from "@/components/AdvancedSunglassesBuilder";
import CatalogueAdmin from "@/components/admin/CatalogueAdmin";

type Module = "bracelet" | "sunglasses" | "admin";

const NAV_ITEMS: { id: Module; label: string; shortLabel: string; icon: typeof Gem }[] = [
  { id: "bracelet", label: "Crystal Bracelet", shortLabel: "Bracelet", icon: Gem },
  { id: "sunglasses", label: "Sunglasses", shortLabel: "Shades", icon: Glasses },
  { id: "admin", label: "Admin", shortLabel: "Admin", icon: Settings },
];

const Index = () => {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeModule = (module === "bracelet" || module === "sunglasses" || module === "admin") ? (module as Module) : "bracelet";

  const [prices, setPrices] = useState({ bracelet: 0, sunglasses: 0 });

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 border-b border-border gap-3">
        <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-foreground whitespace-nowrap">
          Bino Foundry
        </h1>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-1 rounded-lg border border-border p-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(`/${id}`)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-body transition-all duration-200 ${
                  activeModule === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
          <LivePrice price={activeModule === "sunglasses" ? prices.sunglasses : prices.bracelet} />
        </div>

        {/* Mobile: price + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <LivePrice price={activeModule === "sunglasses" ? prices.sunglasses : prices.bracelet} />
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-sm animate-fade-in">
          <nav className="flex flex-col p-2 gap-1">
            {NAV_ITEMS.map(({ id, shortLabel, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { navigate(`/${id}`); setMobileNavOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-body transition-all duration-200 ${
                  activeModule === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {shortLabel}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden">
        <div className={`absolute inset-0 ${activeModule === "bracelet" ? "flex flex-col" : "hidden"}`}>
          <BraceletBuilder onPriceChange={(p) => setPrices(prev => ({ ...prev, bracelet: p }))} />
        </div>
        <div className={`absolute inset-0 ${activeModule === "sunglasses" ? "flex flex-col" : "hidden"}`}>
          <AdvancedSunglassesBuilder onPriceChange={(p) => setPrices(prev => ({ ...prev, sunglasses: p }))} />
        </div>
        <div className={`absolute inset-0 ${activeModule === "admin" ? "flex flex-col" : "hidden"}`}>
          <CatalogueAdmin />
        </div>
      </main>
    </div>
  );
};

export default Index;
