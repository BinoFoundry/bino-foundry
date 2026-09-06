import { describe, expect, it } from "vitest";

import { authCallbackUrl } from "./auth-callback-url";

describe("authCallbackUrl", () => {
  it("includes the base path the app is mounted under", () => {
    // The regression: origin alone pointed at the storefront, which has no
    // /auth/callback route, so every password reset email 404'd.
    expect(authCallbackUrl("https://thenewchapterstudio.com", "/design/")).toBe(
      "https://thenewchapterstudio.com/design/auth/callback",
    );
  });

  it("tolerates a base path with no trailing slash", () => {
    expect(authCallbackUrl("https://thenewchapterstudio.com", "/design")).toBe(
      "https://thenewchapterstudio.com/design/auth/callback",
    );
  });

  it("works when the app is served at the root, as it is locally", () => {
    expect(authCallbackUrl("http://localhost:8080", "/")).toBe(
      "http://localhost:8080/auth/callback",
    );
  });
});
