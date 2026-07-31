import { CircleDot, Gem, Glasses, Ruler, Settings, Settings2, Sun, Users } from "lucide-react";

import { checkPermission } from "@/lib/permissions";
import { useAuth } from "@/state/auth/AuthProvider";
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
  { section: "beads", label: "Bead library", description: "Unified beads with crop workflow", icon: Gem },
  { section: "bead-types", label: "Bead types", description: "Crystal, charm, spacer categories", icon: Settings2 },
  { section: "bead-sizes", label: "Bead sizes", description: "Mm diameter options for the builder", icon: Ruler },
  { section: "wrist-sizes", label: "Wrist sizes", description: "Bracelet capacity targets", icon: CircleDot },
  { section: "general-settings", label: "General settings", description: "Site-wide currency", icon: Settings },
  { section: "sunglasses-config", label: "Sunglasses config", description: "Lens tints and add-ons", icon: Sun },
];

export function AdminDashboardPage({ onNavigate }: AdminDashboardPageProps) {
  const catalogue = useCatalogue();
  const sunglasses = useSunglassesCatalog();
  const { permissions } = useAuth();

  const quickLinksFiltered = [
    ...(checkPermission(permissions, "customers.manage")
      ? [{ section: "users" as const, label: "Users", description: "Accounts, roles, and access", icon: Users }]
      : []),
    ...quickLinks,
  ];

  return (
    <AdminPage>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Manage catalogue products and sunglasses builder pricing.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Frames" value={catalogue.frames?.length ?? 0} />
        <StatCard label="Beads" value={catalogue.beadLibraries.length} />
        <StatCard label="Bead types" value={catalogue.beadTypes.length} />
        <StatCard label="Lens tints" value={sunglasses.lensTints.length} />
        <StatCard label="Builder options" value={sunglasses.builderOptions.length} />
      </div>

      <h3 className="type-label mb-3 text-muted-foreground">
        Quick links
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinksFiltered.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.section}
              type="button"
              onClick={() => onNavigate(link.section)}
              className="surface-card flex items-start gap-3 p-4 text-left transition-colors hover:border-primary/25"
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
    <div className="surface-card px-4 py-3">
      <p className="type-label text-muted-foreground">{label}</p>
      <p className="type-price mt-1 text-2xl">{value}</p>
    </div>
  );
}
