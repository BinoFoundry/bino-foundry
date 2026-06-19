import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getEnv, isProductionLike } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
export const ENCRYPTED_SECRET_PREFIX = "v1";

export type StoredSecretStorage = "encrypted" | "plaintext" | "missing" | "invalid";

export interface StoredSecretReadResult {
  storage: StoredSecretStorage;
  value: string;
  /** Set when storage is invalid (corrupt ciphertext or wrong encryption key). */
  reason?: string;
  /** True when decrypted with a legacy key and should be re-encrypted on next save. */
  needsKeyMigration?: boolean;
  /** Key fingerprint used for a successful decrypt (never includes secret material). */
  decryptedWithKeyFingerprint?: string;
}

interface EncryptionKeyCandidate {
  fingerprint: string;
  key: Buffer;
}

function fingerprintKeyMaterial(label: string, material: Buffer | string): string {
  const hash = createHash("sha256")
    .update(typeof material === "string" ? material : material)
    .digest("hex")
    .slice(0, 12);
  return `${label}:${hash}`;
}

function resolvePrimaryEncryptionKey(): Buffer {
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

function resolveLegacyEncryptionKey(): Buffer | null {
  const configured = getEnv().SETTINGS_ENCRYPTION_KEY?.trim();
  if (!configured) {
    return null;
  }

  const fallback = getEnv().JWT_SECRET?.trim() ?? "bino-foundry-dev-settings-key";
  return createHash("sha256").update(fallback).digest();
}

function listEncryptionKeyCandidates(): EncryptionKeyCandidate[] {
  const primary = resolvePrimaryEncryptionKey();
  const candidates: EncryptionKeyCandidate[] = [
    {
      fingerprint: getEncryptionKeyFingerprint(),
      key: primary,
    },
  ];

  const legacy = resolveLegacyEncryptionKey();
  if (legacy && !legacy.equals(primary)) {
    const fallback = getEnv().JWT_SECRET?.trim() ?? "bino-foundry-dev-settings-key";
    candidates.push({
      fingerprint: fingerprintKeyMaterial("jwt-fallback", fallback),
      key: legacy,
    });
  }

  return candidates;
}

/** Fingerprint of the primary encryption key (safe to log). */
export function getEncryptionKeyFingerprint(): string {
  const configured = getEnv().SETTINGS_ENCRYPTION_KEY?.trim();
  if (configured) {
    try {
      const key = Buffer.from(configured, "base64");
      return fingerprintKeyMaterial("settings-key", key);
    } catch {
      return "settings-key:invalid";
    }
  }

  const fallback = getEnv().JWT_SECRET?.trim() ?? "bino-foundry-dev-settings-key";
  return fingerprintKeyMaterial("jwt-fallback", fallback);
}

function decryptSecretWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== ENCRYPTED_SECRET_PREFIX) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const encrypted = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export type DecryptStoredSecretResult =
  | { ok: true; value: string; keyFingerprint: string }
  | { ok: false; errorType: string; errorMessage: string };

/** Try decrypting with primary key, then legacy JWT-derived key when configured. */
export function tryDecryptStoredSecret(payload: string): DecryptStoredSecretResult {
  let lastError: unknown;

  for (const candidate of listEncryptionKeyCandidates()) {
    try {
      return {
        ok: true,
        value: decryptSecretWithKey(payload, candidate.key),
        keyFingerprint: candidate.fingerprint,
      };
    } catch (err) {
      lastError = err;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : "Decryption failed";
  const errorType = lastError instanceof Error ? lastError.name : "Error";
  return { ok: false, errorType, errorMessage };
}

/** Encrypt a secret for at-rest storage. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, resolvePrimaryEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_SECRET_PREFIX, iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(
    ":",
  );
}

/** True when the value matches the v1 encrypted secret envelope (not necessarily decryptable). */
export function isEncryptedSecretFormat(payload: string): boolean {
  const parts = payload.trim().split(":");
  if (parts.length !== 4 || parts[0] !== ENCRYPTED_SECRET_PREFIX) return false;
  return parts.slice(1).every((part) => part.length > 0);
}

/**
 * Read a stored secret — supports legacy plaintext rows and encrypted v1 payloads.
 * Never throws; invalid ciphertext returns storage=invalid with a reason.
 */
export function readStoredSecret(payload: string | null | undefined): StoredSecretReadResult {
  const trimmed = payload?.trim();
  if (!trimmed) {
    return { storage: "missing", value: "" };
  }

  if (!isEncryptedSecretFormat(trimmed)) {
    return { storage: "plaintext", value: trimmed };
  }

  const attempt = tryDecryptStoredSecret(trimmed);
  if (attempt.ok) {
    const primaryFingerprint = getEncryptionKeyFingerprint();
    const needsKeyMigration = attempt.keyFingerprint !== primaryFingerprint;
    return {
      storage: "encrypted",
      value: attempt.value,
      needsKeyMigration,
      decryptedWithKeyFingerprint: attempt.keyFingerprint,
    };
  }

  return {
    storage: "invalid",
    value: "",
    reason: `Stored value looks encrypted but could not be decrypted (${attempt.errorType}: ${attempt.errorMessage}). Re-enter the credential and save SMTP settings.`,
  };
}

/**
 * Persist a secret — always encrypts plaintext input with the primary key.
 * When keeping an existing DB value, re-encrypts legacy plaintext or legacy-key ciphertext on save.
 */
export function persistSecretForStorage(
  currentStored: string | null | undefined,
  newPlaintext?: string | null,
): string | null {
  const incoming = newPlaintext?.trim();
  if (incoming) {
    return encryptSecret(incoming);
  }

  if (!currentStored?.trim()) {
    return null;
  }

  const existing = readStoredSecret(currentStored);
  if (existing.storage === "plaintext") {
    return encryptSecret(existing.value);
  }
  if (existing.storage === "encrypted") {
    if (existing.needsKeyMigration) {
      return encryptSecret(existing.value);
    }
    return currentStored.trim();
  }
  // invalid — do not keep undecryptable ciphertext when saving other settings
  return null;
}

/** Decrypt a stored secret using the primary key only. Never log the result. */
export function decryptSecret(payload: string): string {
  return decryptSecretWithKey(payload, resolvePrimaryEncryptionKey());
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
