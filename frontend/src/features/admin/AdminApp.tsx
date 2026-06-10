import { useState } from "react";

import { AdminLayout } from "./components/AdminLayout";
import { AdminMobileNav } from "./components/AdminMobileNav";
import { AdminDashboardPage } from "./modules/dashboard/AdminDashboardPage";
import { MediaManagerPage } from "./modules/media/MediaManagerPage";
import { GeneralSettingsPage } from "./modules/settings/GeneralSettingsPage";
import { SunglassesConfigPage } from "./modules/pricing/SunglassesConfigPage";
import { BeadsAdminPage } from "./modules/products/BeadsAdminPage";
import { BeadSizesAdminPage } from "./modules/products/BeadSizesAdminPage";
import { WristSizesAdminPage } from "./modules/products/WristSizesAdminPage";
import { BeadTypesAdminPage } from "./modules/products/BeadTypesAdminPage";
import { FramesAdminPage } from "./modules/products/FramesAdminPage";
import { UsersAdminPage } from "./modules/users/UsersAdminPage";
import type { AdminSection } from "./types";

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
    case "general-settings":
      return <GeneralSettingsPage />;
    case "sunglasses-config":
      return <SunglassesConfigPage />;
    case "media":
      return <MediaManagerPage />;
    default:
      return <AdminDashboardPage onNavigate={onNavigate} />;
  }
}

export function AdminApp() {
  const [section, setSection] = useState<AdminSection>("dashboard");

  return (
    <AdminLayout section={section} onSectionChange={setSection}>
      <AdminMobileNav section={section} onSectionChange={setSection} />
      <AdminSectionView section={section} onNavigate={setSection} />
    </AdminLayout>
  );
}

export default AdminApp;
