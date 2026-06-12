import { z } from "zod";

const smtpEncryptionSchema = z.enum(["none", "ssl", "tls", "starttls"]);

const hostSchema = z
  .string()
  .trim()
  .min(1, "SMTP host is required")
  .max(253)
  .refine((value) => /^[a-zA-Z0-9.-]+$/.test(value), "Invalid SMTP host");

const portSchema = z.coerce.number().int().min(1).max(65535);

const emailSchema = z.string().trim().email("Enter a valid sender email address");

export const smtpSettingsUpdateDto = z.object({
  isActive: z.boolean(),
  host: hostSchema,
  port: portSchema,
  encryption: smtpEncryptionSchema,
  username: z.string().trim().max(320).optional(),
  password: z.string().max(512).optional(),
  fromName: z.string().trim().max(120),
  fromEmail: emailSchema,
});

export const smtpTestDto = z.object({
  recipientEmail: z.string().trim().email("Enter a valid test recipient email"),
  useSaved: z.boolean().optional(),
  isActive: z.boolean().optional(),
  host: hostSchema.optional(),
  port: portSchema.optional(),
  encryption: smtpEncryptionSchema.optional(),
  username: z.string().trim().max(320).optional(),
  password: z.string().max(512).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: emailSchema.optional(),
});
