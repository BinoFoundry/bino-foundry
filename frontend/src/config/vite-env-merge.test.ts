import { describe, expect, it } from "vitest";

import { mergeFrontendViteEnv, pickEnvValue } from "./vite-env-merge";

describe("vite-env-merge", () => {
  it("picks the first non-empty value", () => {
    expect(pickEnvValue("", "  ", "abc")).toBe("abc");
    expect(pickEnvValue(undefined, "x")).toBe("x");
  });

  it("mirrors ADMIN_API_KEY into local development builds", () => {
    const env = mergeFrontendViteEnv({
      frontendEnv: {},
      rootEnv: { ADMIN_API_KEY: "server-secret" },
      mode: "development",
    });
    expect(env.VITE_ADMIN_API_KEY).toBe("server-secret");
  });

  it("never mirrors ADMIN_API_KEY into a deployed build", () => {
    // Anything VITE_* is inlined into the JavaScript the browser downloads, so
    // mirroring here published the key that authorises catalogue writes.
    for (const mode of ["production", "staging"]) {
      const env = mergeFrontendViteEnv({
        frontendEnv: {},
        rootEnv: { ADMIN_API_KEY: "server-secret" },
        mode,
      });
      expect(env.VITE_ADMIN_API_KEY).toBe("");
    }
  });

  it("still allows a deliberately exported key", () => {
    const env = mergeFrontendViteEnv({
      frontendEnv: { VITE_ADMIN_API_KEY: "deliberate" },
      rootEnv: { ADMIN_API_KEY: "server-secret" },
      mode: "production",
    });
    expect(env.VITE_ADMIN_API_KEY).toBe("deliberate");
  });

  it("prefers frontend VITE_ADMIN_API_KEY over root values", () => {
    const env = mergeFrontendViteEnv({
      frontendEnv: { VITE_ADMIN_API_KEY: "spa-secret" },
      rootEnv: { ADMIN_API_KEY: "server-secret", VITE_ADMIN_API_KEY: "root-vite-secret" },
    });
    expect(env.VITE_ADMIN_API_KEY).toBe("spa-secret");
  });

  it("prefers frontend API base URL", () => {
    const env = mergeFrontendViteEnv({
      frontendEnv: { VITE_API_BASE_URL: "http://localhost:5050" },
      rootEnv: { VITE_API_BASE_URL: "https://api.example.com" },
    });
    expect(env.VITE_API_BASE_URL).toBe("http://localhost:5050");
  });
});
