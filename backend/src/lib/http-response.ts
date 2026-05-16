import type { Response } from "express";

/** Catalogue endpoints keep the Phase 1 “raw JSON body” shape for SPA compatibility */
export function sendJson(res: Response, body: unknown, status = 200): void {
  res.status(status).json(body);
}

export function sendCreated(res: Response, body: unknown): void {
  res.status(201).json(body);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
