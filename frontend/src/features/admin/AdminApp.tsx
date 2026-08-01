import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";

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
import { adminSectionPath, isAdminSection, parseAdminSection } from "./routing";
import type { AdminSection } from "./types";

function useActiveAdminSection(): AdminSection {
  const { pathname } = useLocation();
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  if (pathname.startsWith("/admin/bead-types")) return "bead-types";
  const maybe = pathname.split("/")[2];
  return parseAdminSection(maybe ?? null);
}

function AdminShellLayout() {
  const section = useActiveAdminSection();
  const navigate = useNavigate();

  const handleSectionChange = (next: AdminSection) => {
    navigate(adminSectionPath(next));
  };

  return (
    <AdminSectionRefreshProvider>
      <AdminLayout section={section} onSectionChange={handleSectionChange}>
        <AdminMobileNav section={section} onSectionChange={handleSectionChange} />
        <Outlet />
      </AdminLayout>
    </AdminSectionRefreshProvider>
  );
}

function DashboardRoute() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const legacy = new URLSearchParams(search).get("section");
  if (legacy && isAdminSection(legacy) && legacy !== "dashboard") {
    const params = new URLSearchParams(search);
    params.delete("section");
    const rest = params.toString();
    return <Navigate to={`${adminSectionPath(legacy)}${rest ? `?${rest}` : ""}`} replace />;
  }
  return <AdminDashboardPage onNavigate={(s) => navigate(adminSectionPath(s))} />;
}

/**
 * Nested under App route `/admin/*`.
 * Paths here are relative to that splat ("" | "beads" | "beads/:id" | …), not absolute `/admin/...`.
 */
export function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminShellLayout />}>
        <Route index element={<DashboardRoute />} />
        <Route path="users" element={<UsersAdminPage />} />
        <Route path="users/new" element={<UsersAdminPage />} />
        <Route path="users/:itemId" element={<UsersAdminPage />} />
        <Route path="frames" element={<FramesAdminPage />} />
        <Route path="frames/new" element={<FramesAdminPage />} />
        <Route path="frames/:itemId" element={<FramesAdminPage />} />
        <Route path="beads" element={<BeadsAdminPage />} />
        <Route path="beads/new" element={<BeadsAdminPage />} />
        <Route path="beads/:itemId" element={<BeadsAdminPage />} />
        <Route path="bead-types" element={<BeadTypesAdminPage />} />
        <Route path="bead-types/new" element={<BeadTypesAdminPage />} />
        <Route path="bead-types/:typeId" element={<BeadTypesAdminPage />} />
        <Route path="bead-types/:typeId/sub-types" element={<BeadTypesAdminPage />} />
        <Route path="bead-types/:typeId/sub-types/new" element={<BeadTypesAdminPage />} />
        <Route path="bead-types/:typeId/sub-types/:subId" element={<BeadTypesAdminPage />} />
        <Route path="bead-sizes" element={<BeadSizesAdminPage />} />
        <Route path="bead-sizes/new" element={<BeadSizesAdminPage />} />
        <Route path="bead-sizes/:itemId" element={<BeadSizesAdminPage />} />
        <Route path="wrist-sizes" element={<WristSizesAdminPage />} />
        <Route path="wrist-sizes/new" element={<WristSizesAdminPage />} />
        <Route path="wrist-sizes/:itemId" element={<WristSizesAdminPage />} />
        <Route path="how-we-prepare" element={<HowWePrepareAdminPage />} />
        <Route path="how-we-prepare/new" element={<HowWePrepareAdminPage />} />
        <Route path="how-we-prepare/:itemId" element={<HowWePrepareAdminPage />} />
        <Route path="general-settings" element={<GeneralSettingsPage />} />
        <Route path="sunglasses-config" element={<SunglassesConfigPage />} />
        <Route path="lens-render-presets" element={<LensRenderingPresetsAdminPage />} />
        <Route path="lens-render-presets/new" element={<LensRenderingPresetsAdminPage />} />
        <Route path="lens-render-presets/:itemId" element={<LensRenderingPresetsAdminPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

export default AdminApp;
