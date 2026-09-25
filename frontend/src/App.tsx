import { Navigate, Route, createBrowserRouter, createRoutesFromElements } from "react-router-dom";
import { lazy, Suspense } from "react";

import { LoadingState } from "@/components/common";
import { AppProviders } from "@/providers";
import Index from "./pages/Index.tsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import DevRefreshBeadAssetsPage from "./pages/DevRefreshBeadAssetsPage.tsx";

const CustomerPortalApp = lazy(() => import("@/features/customer-portal/CustomerPortalApp"));

/**
 * Data router so builders can use `useBlocker` for unsaved-change navigation guards.
 */
export const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppProviders />}>
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
      <Route path="/bracelet" element={<Index />} />
      <Route path="/sunglasses" element={<Index />} />
      <Route path="/admin/*" element={<Index />} />
      {import.meta.env.DEV && (
        <Route path="/dev/refresh-bead-assets" element={<DevRefreshBeadAssetsPage />} />
      )}
      {/* Unknown paths (e.g. /handover) → 404; do not fall back to the bracelet home */}
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
  {
    // Vite sets BASE_URL from `base` in vite.config.ts — "/" locally, "/design/"
    // when the New Chapter storefront serves this app under that path. Without
    // a matching basename every internal link would navigate to /bracelet on
    // the storefront's domain and hit its 404. Router wants no trailing slash.
    basename: import.meta.env.BASE_URL.replace(/\/+$/, "") || "/",
  },
);
