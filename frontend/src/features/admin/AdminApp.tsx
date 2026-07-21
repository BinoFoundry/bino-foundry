import { useSearchParams } from "react-router-dom";

import { AdminLayout } from "./components/AdminLayout";
import { AdminMobileNav } from "./components/AdminMobileNav";
import { AdminSectionRefreshProvider } from "./context/AdminSectionRefreshContext";
import { AdminDashboardPage } from "./modules/dashboard/AdminDashboardPage";
import { HowWePrepareAdminPage } from "./modules/settings/HowWePrepareAdminPage";
import { GeneralSettingsPage } from "./modules/settings/GeneralSettingsPage";
import { SunglassesConfigPage } from "./modules/pricing/SunglassesConfigPage";
import { BeadsAdminPage } from "./modules/products/BeadsAdminPage";
import { BeadSizesAdminPage } from "./modules/products/BeadSizesAdminPage";
import { WristSizesAdminPage } from "./modules/products/WristSizesAdminPage";
import { BeadTypesAdminPage } from "./modules/products/BeadTypesAdminPage";
import { FramesAdminPage } from "./modules/products/FramesAdminPage";
import { UsersAdminPage } from "./modules/users/UsersAdminPage";
import { LensRenderingPresetsAdminPage } from "./modules/sunglasses/LensRenderingPresetsAdminPage";
import type { AdminSection } from "./types";

const ADMIN_SECTIONS = new Set<AdminSection>([
  "dashboard",
  "users",
  "frames",
  "beads",
  "bead-types",
  "bead-sizes",
  "wrist-sizes",
  "how-we-prepare",
  "general-settings",
  "sunglasses-config",
  "lens-render-presets",
]);

function parseAdminSection(raw: string | null): AdminSection {
  if (raw && ADMIN_SECTIONS.has(raw as AdminSection)) {
    return raw as AdminSection;
  }
  return "dashboard";
}

function AdminSectionView({
  section,
  onNavigate,
}: {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
}) {
  switch (section) {
    case "dashboard":
      return <AdminDashboardPage onNavigate={onNavigate} />;
    case "users":
      return <UsersAdminPage />;
    case "frames":
      return <FramesAdminPage />;
    case "beads":
      return <BeadsAdminPage />;
    case "bead-types":
      return <BeadTypesAdminPage />;
    case "bead-sizes":
      return <BeadSizesAdminPage />;
    case "wrist-sizes":
      return <WristSizesAdminPage />;
    case "how-we-prepare":
      return <HowWePrepareAdminPage />;
    case "general-settings":
      return <GeneralSettingsPage />;
    case "sunglasses-config":
      return <SunglassesConfigPage />;
    case "lens-render-presets":
      return <LensRenderingPresetsAdminPage />;
    default:
      return <AdminDashboardPage onNavigate={onNavigate} />;
  }
}

export function AdminApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseAdminSection(searchParams.get("section"));

  const handleSectionChange = (next: AdminSection) => {
    setSearchParams(next === "dashboard" ? {} : { section: next }, { replace: true });
  };

  return (
    <AdminSectionRefreshProvider>
      <AdminLayout section={section} onSectionChange={handleSectionChange}>
        <AdminMobileNav section={section} onSectionChange={handleSectionChange} />
        <AdminSectionView section={section} onNavigate={handleSectionChange} />
      </AdminLayout>
    </AdminSectionRefreshProvider>
  );
}

export default AdminApp;
