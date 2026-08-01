import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";

import { LoadingState } from "@/components/common";
import { AppProviders } from "@/providers";
import Index from "./pages/Index.tsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const CustomerPortalApp = lazy(() => import("@/features/customer-portal/CustomerPortalApp"));

const App = () => (
  <AppProviders>
    <Routes>
      <Route path="/" element={<Navigate to="/bracelet" replace />} />
      <Route
        path="/account/*"
        element={
          <Suspense fallback={<LoadingState label="Loading your portal…" className="min-h-screen" />}>
            <CustomerPortalApp />
          </Suspense>
        }
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {/* Nested admin deep links: /admin, /admin/beads/:id, … */}
      <Route path="/admin/*" element={<Index />} />
      <Route path="/:module" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppProviders>
);

export default App;
