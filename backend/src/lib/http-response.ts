import type { Request, Response } from "express";

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

/** Optional v2-style envelope for new endpoints (legacy routes stay raw JSON). */
export function sendData<T>(req: Request, res: Response, data: T, status = 200): void {
  res.status(status).json({
    data,
    meta: {
      requestId: req.requestId,
    },
  });
}

export function sendDataCreated<T>(req: Request, res: Response, data: T): void {
  sendData(req, res, data, 201);
}
