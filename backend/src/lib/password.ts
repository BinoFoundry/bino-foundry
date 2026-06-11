import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Placeholder hash for legacy migrated accounts — login is blocked until password reset. */
export const MIGRATION_PASSWORD_HASH =
  "$2a$12$MIGRATION.REQUIRES.PASSWORD.RESET.VIA.FORGOT.PASSWORD";

export function isMigrationPasswordHash(hash: string): boolean {
  return hash === MIGRATION_PASSWORD_HASH;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (isMigrationPasswordHash(hash)) return false;
  return bcrypt.compare(plain, hash);
}
