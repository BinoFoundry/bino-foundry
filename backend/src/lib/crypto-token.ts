import { createHash, randomBytes } from "node:crypto";

/** Opaque token returned to clients; only the hash is stored. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
