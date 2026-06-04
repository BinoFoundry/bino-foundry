declare global {
  namespace Express {
    interface Request {
      /** Populated via `requestContextMiddleware` */
      requestId?: string;
      /** Set by auth middleware on protected routes */
      auth?:
        | { scheme: "api-key" }
        | { scheme: "jwt"; userId: string; email?: string; isAdmin: boolean };
    }
  }
}

export {};
