import type { Request } from "express";

/** When true, list endpoints return only rows visible in product builders. */
export function listForBuilderFromQuery(req: Pick<Request, "query">): boolean {
  const raw = req.query.forBuilder;
  return raw === "1" || raw === "true";
}
