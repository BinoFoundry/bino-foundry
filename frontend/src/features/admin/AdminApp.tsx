import { useState } from "react";

import { AdminLayout } from "./components/AdminLayout";
import { AdminMobileNav } from "./components/AdminMobileNav";
import { AdminDashboardPage } from "./modules/dashboard/AdminDashboardPage";
import { MediaManagerPage } from "./modules/media/MediaManagerPage";
import { PricingConfigPage } from "./modules/pricing/PricingConfigPage";
import { BeadsAdminPage } from "./modules/products/BeadsAdminPage";
import { BeadSizesAdminPage } from "./modules/products/BeadSizesAdminPage";
import { BeadTypesAdminPage } from "./modules/products/BeadTypesAdminPage";
import { FramesAdminPage } from "./modules/products/FramesAdminPage";
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
    case "frames":
      return <FramesAdminPage />;
    case "beads":
      return <BeadsAdminPage />;
    case "bead-types":
      return <BeadTypesAdminPage />;
    case "bead-sizes":
      return <BeadSizesAdminPage />;
    case "pricing":
      return <PricingConfigPage />;
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
