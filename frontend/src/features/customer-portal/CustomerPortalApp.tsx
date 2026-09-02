import { Navigate, Route, Routes } from "react-router-dom";

import { AnnouncementBar } from "@/layouts/AnnouncementBar";
import { GlobalHeader } from "@/layouts/GlobalHeader";
import { RequireCustomerAuth } from "@/features/auth/RequireCustomerAuth";

import { CustomerPortalLayout } from "./layout/CustomerPortalLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { DesignsPage } from "./pages/DesignsPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function CustomerPortalApp() {
  return (
    <div className="surface-page min-h-[100dvh]">
      <AnnouncementBar />
      <GlobalHeader />
      <RequireCustomerAuth>
        <CustomerPortalLayout>
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<Navigate to="/account" replace />} />
            <Route path="designs" element={<DesignsPage />} />
            <Route path="designs/bracelet" element={<DesignsPage />} />
            <Route path="designs/sunglasses" element={<DesignsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/account" replace />} />
          </Routes>
        </CustomerPortalLayout>
      </RequireCustomerAuth>
    </div>
  );
}
