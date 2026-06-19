/** SMTP encryption modes supported by the platform mail service. */
export type SmtpEncryption = "none" | "ssl" | "tls" | "starttls";

export const SMTP_ENCRYPTION_OPTIONS: readonly {
  value: SmtpEncryption;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "ssl", label: "SSL" },
  { value: "tls", label: "TLS" },
  { value: "starttls", label: "STARTTLS" },
] as const;

/** Admin-safe SMTP settings — never includes decrypted credentials. */
export interface SmtpSettingsPublic {
  isActive: boolean;
  host: string;
  port: number;
  encryption: SmtpEncryption;
  /** Masked username hint when configured (e.g. sm•••@example.com). */
  usernameMasked: string | null;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  updatedAt: string | null;
  /** How username/password are stored in the database. */
  credentialStorage: {
    username: SmtpCredentialStorage;
    password: SmtpCredentialStorage;
  };
  /** True when plaintext legacy values or invalid ciphertext need admin re-save. */
  credentialsNeedResave: boolean;
  /** Human-readable hint when credentialsNeedResave is true. */
  credentialWarning: string | null;
  /** Fingerprint of the active encryption key (safe to display). */
  encryptionKeyFingerprint?: string | null;
  /** Decrypt failure detail when credential storage is invalid. */
  credentialDecryptError?: string | null;
}

export type SmtpCredentialStorage = "encrypted" | "plaintext" | "missing" | "invalid";

export interface SmtpSettingsUpdate {
  isActive: boolean;
  host: string;
  port: number;
  encryption: SmtpEncryption;
  /** Omit or empty string to keep existing username. */
  username?: string;
  /** Omit or empty string to keep existing password. */
  password?: string;
  fromName: string;
  fromEmail: string;
}

export interface SmtpTestRequest {
  recipientEmail: string;
  /** When true (default), test persisted settings; otherwise use inline overrides below. */
  useSaved?: boolean;
  isActive?: boolean;
  host?: string;
  port?: number;
  encryption?: SmtpEncryption;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
}

export interface SmtpTestResult {
  success: boolean;
  connectionOk: boolean;
  emailSent: boolean;
  message: string;
}
