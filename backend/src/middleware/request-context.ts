import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Adds `requestId` and echoes common correlation headers through `x-request-id`. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    (typeof req.headers["x-correlation-id"] === "string" && req.headers["x-correlation-id"]) ||
    (typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"]) ||
    "";

  const id = incoming && incoming.length > 0 ? incoming : randomUUID();

  req.requestId = id;
  res.setHeader("x-request-id", id);

  next();
}
