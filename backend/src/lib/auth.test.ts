import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword, isMigrationPasswordHash } from "./password.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";
import { buildAuthUserFromDb, permissionsForRole, toPublicRole } from "./rbac.js";
import type { DbUser } from "../infra/auth/user-repository.js";

describe("password", () => {
  it("hashes and verifies credentials", async () => {
    const hash = await hashPassword("secret-password");
    expect(await verifyPassword("secret-password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("blocks migrated placeholder hashes", () => {
    expect(isMigrationPasswordHash("$2a$12$MIGRATION.REQUIRES.PASSWORD.RESET.VIA.FORGOT.PASSWORD")).toBe(true);
  });
});

describe("jwt", () => {
  it("issues and verifies access tokens", () => {
    const { token, expiresAt } = signAccessToken("user-1", "customer");
    const payload = verifyAccessToken(token);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.role).toBe("customer");
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("rbac", () => {
  it("maps database users to authenticated principals", () => {
    const user: DbUser = {
      id: "user-1",
      roleId: 2,
      roleCode: "customer",
      fullName: "Test User",
      email: "test@example.com",
      passwordHash: "hash",
      phoneNumber: null,
      avatar: null,
      status: "active",
      emailVerifiedAt: "2026-01-01T00:00:00.000Z",
      lastLoginAt: null,
      billingDetails: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };

    const authUser = buildAuthUserFromDb(user);
    expect(authUser.permissions).toEqual(permissionsForRole("customer"));
    expect(authUser.emailVerified).toBe(true);
  });

  it("collapses internal roles to the public admin role", () => {
    expect(toPublicRole("staff")).toBe("admin");
    expect(toPublicRole("super_admin")).toBe("admin");
    expect(toPublicRole("customer")).toBe("customer");
  });
});
