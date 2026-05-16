declare global {
  namespace Express {
    interface Request {
      /** Populated via `requestContextMiddleware` */
      requestId?: string;
      /** Present when authenticated via admin API key on mutation routes */
      auth?: { scheme: "api-key" };
    }
  }
}

export {};
