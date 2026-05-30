import { Router } from "express";

import { settingsHandlers } from "./settings.controller.js";

export function createSettingsRoutes(): Router {
  const router = Router();
  router.get("/general", settingsHandlers.getGeneralSettings);
  router.put("/general", settingsHandlers.updateGeneralSettings);
  return router;
}
