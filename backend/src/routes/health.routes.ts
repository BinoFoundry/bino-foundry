import { Router } from "express";

import { getEnv } from "../config/env.js";
import { sendJson } from "../lib/http-response.js";

export function createMonitoringRoutes(): Router {
  const router = Router();
  router.get("/status", (_req, res) => {
    const env = getEnv();
    sendJson(res, {
      status: "ok",
      app: "bino-foundry-api",
      appEnv: env.APP_ENV,
      nodeEnv: env.NODE_ENV,
    });
  });
  router.get("/health", (_req, res) => {
    sendJson(res, { status: "ok" });
  });
  return router;
}
