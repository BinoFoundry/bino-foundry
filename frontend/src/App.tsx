import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppProviders } from "@/providers";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/bracelet" replace />} />
        <Route path="/:module" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </AppProviders>
);

export default App;
