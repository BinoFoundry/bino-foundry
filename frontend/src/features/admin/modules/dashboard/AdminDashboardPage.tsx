import { Gem, Glasses, Image, Settings2, Sun } from "lucide-react";

import { useCatalogue } from "@/state/catalogue";
import { useSunglassesCatalog } from "@/state/sunglasses-catalog";

import { AdminPage } from "../../components/AdminPage";
import type { AdminSection } from "../../types";

interface AdminDashboardPageProps {
  onNavigate: (section: AdminSection) => void;
}

const quickLinks: {
  section: AdminSection;
  label: string;
  description: string;
  icon: typeof Glasses;
}[] = [
  { section: "frames", label: "Frames", description: "Sunglasses frame SKUs", icon: Glasses },
  { section: "crystals", label: "Bracelet items", description: "Crystals, charms, spacers", icon: Gem },
  { section: "types", label: "Bracelet types", description: "Crystal/charm/spacer taxonomies", icon: Settings2 },
  { section: "pricing", label: "Sunglasses config", description: "Lens tints and add-ons", icon: Sun },
  { section: "media", label: "Media", description: "Staging uploads", icon: Image },
];

export function AdminDashboardPage({ onNavigate }: AdminDashboardPageProps) {
  const catalogue = useCatalogue();
  const sunglasses = useSunglassesCatalog();

  return (
    <AdminPage>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Manage catalogue products, sunglasses builder pricing, and media assets. Mutations require{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_ADMIN_API_KEY</code> when calling
        the API.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Frames" value={catalogue.frames?.length ?? 0} />
        <StatCard label="Crystals" value={catalogue.crystals.length} />
        <StatCard label="Charms" value={catalogue.charms.length} />
        <StatCard label="Spacers" value={catalogue.spacers.length} />
        <StatCard label="Crystal types" value={catalogue.types?.length ?? 0} />
        <StatCard label="Charm types" value={catalogue.charmTypes?.length ?? 0} />
        <StatCard label="Spacer types" value={catalogue.spacerTypes?.length ?? 0} />
        <StatCard label="Lens tints" value={sunglasses.lensTints.length} />
        <StatCard label="Builder options" value={sunglasses.builderOptions.length} />
      </div>

      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Quick links
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.section}
              type="button"
              onClick={() => onNavigate(link.section)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block font-medium text-foreground">{link.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{link.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </AdminPage>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
