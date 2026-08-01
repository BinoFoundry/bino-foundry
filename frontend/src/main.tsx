import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { appRouter } from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<RouterProvider router={appRouter} />);
