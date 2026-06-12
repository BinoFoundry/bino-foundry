import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, maskSecretHint } from "./secret-cipher.js";

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
});
