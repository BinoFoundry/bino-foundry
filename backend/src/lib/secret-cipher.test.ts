import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  getEncryptionKeyFingerprint,
  isEncryptedSecretFormat,
  maskSecretHint,
  persistSecretForStorage,
  readStoredSecret,
} from "./secret-cipher.js";

describe("secret-cipher", () => {
  it("round-trips encrypted secrets", () => {
    const plain = "smtp-user@example.com";
    const encrypted = encryptSecret(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it("masks username hints", () => {
    expect(maskSecretHint("smtp-user@example.com")).toBe("sm•••@example.com");
    expect(maskSecretHint("secret")).toBe("se••••");
  });

  it("detects encrypted envelope format", () => {
    const encrypted = encryptSecret("secret");
    expect(isEncryptedSecretFormat(encrypted)).toBe(true);
    expect(isEncryptedSecretFormat("plain-smtp-user")).toBe(false);
    expect(isEncryptedSecretFormat("v1:only:three")).toBe(false);
  });

  it("reads legacy plaintext storage", () => {
    const read = readStoredSecret("smtp-user@example.com");
    expect(read.storage).toBe("plaintext");
    expect(read.value).toBe("smtp-user@example.com");
  });

  it("reads encrypted storage", () => {
    const encrypted = encryptSecret("hunter2");
    const read = readStoredSecret(encrypted);
    expect(read.storage).toBe("encrypted");
    expect(read.value).toBe("hunter2");
  });

  it("marks corrupt ciphertext as invalid without throwing", () => {
    const read = readStoredSecret("v1:AAAA:BBBB:CCCC");
    expect(read.storage).toBe("invalid");
    expect(read.value).toBe("");
    expect(read.reason).toMatch(/decrypt/i);
  });

  it("encrypts new plaintext on persist", () => {
    const stored = persistSecretForStorage(null, "new-secret");
    expect(stored).toBeTruthy();
    expect(isEncryptedSecretFormat(stored!)).toBe(true);
    expect(decryptSecret(stored!)).toBe("new-secret");
  });

  it("migrates legacy plaintext to encrypted on persist without new input", () => {
    const stored = persistSecretForStorage("legacy-plain-user", undefined);
    expect(stored).toBeTruthy();
    expect(isEncryptedSecretFormat(stored!)).toBe(true);
    expect(decryptSecret(stored!)).toBe("legacy-plain-user");
  });

  it("keeps valid encrypted value when not rotated", () => {
    const encrypted = encryptSecret("keep-me");
    const stored = persistSecretForStorage(encrypted, undefined);
    expect(stored).toBe(encrypted);
  });

  it("clears invalid ciphertext when saving without new plaintext", () => {
    const stored = persistSecretForStorage("v1:AAAA:BBBB:CCCC", undefined);
    expect(stored).toBeNull();
  });

  it("exposes encryption key fingerprint without secret material", () => {
    const fingerprint = getEncryptionKeyFingerprint();
    expect(fingerprint).toMatch(/^(settings-key|jwt-fallback):[a-f0-9]{12}$/);
  });
});
