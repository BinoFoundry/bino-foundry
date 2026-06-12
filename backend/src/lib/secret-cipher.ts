import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getEnv, isProductionLike } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1";

function resolveEncryptionKey(): Buffer {
  const configured = getEnv().SETTINGS_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error("SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (base64)");
    }
    return key;
  }

  if (isProductionLike()) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is required in staging and production");
  }

  const fallback = getEnv().JWT_SECRET?.trim() ?? "bino-foundry-dev-settings-key";
  return createHash("sha256").update(fallback).digest();
}

/** Encrypt a secret for at-rest storage. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, resolveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(
    ":",
  );
}

/** Decrypt a stored secret. Never log the result. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv(ALGORITHM, resolveEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Mask a username/email for admin display. */
export function maskSecretHint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "••••••••";
  if (trimmed.includes("@")) {
    const [local, domain] = trimmed.split("@");
    const head = local.slice(0, Math.min(2, local.length));
    return `${head}•••@${domain}`;
  }
  if (trimmed.length <= 2) return "••••••••";
  return `${trimmed.slice(0, 2)}••••`;
}
