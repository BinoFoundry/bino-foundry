import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 5 rejects async rejects unless wrapped — centralize here */
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void | unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
