import { useState } from "react";

import { AdminLayout } from "./components/AdminLayout";
import { AdminMobileNav } from "./components/AdminMobileNav";
import { AdminDashboardPage } from "./modules/dashboard/AdminDashboardPage";
import { MediaManagerPage } from "./modules/media/MediaManagerPage";
import { SunglassesPricingPage } from "./modules/pricing/SunglassesPricingPage";
import { CrystalsAdminPage } from "./modules/products/CrystalsAdminPage";
import { FramesAdminPage } from "./modules/products/FramesAdminPage";
import { TypesAdminPage } from "./modules/products/TypesAdminPage";
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
    case "crystals":
      return <CrystalsAdminPage />;
    case "types":
      return <TypesAdminPage />;
    case "pricing":
      return <SunglassesPricingPage />;
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
