import { z } from "zod";

export const MAX_PASSWORD_BYTES = 72; // bcrypt truncates input beyond 72 bytes
export const MAX_PASSWORD_CHARS = 128;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Please enter a valid email address.")
  .max(254, "Email is too long.")
  .email("Please enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const signupNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(60, "Name must be 60 characters or fewer.")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Name contains unsupported characters.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Name contains unsupported characters.");

export const signupPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(MAX_PASSWORD_CHARS, "Password must be 128 characters or fewer.")
  .refine(
    (value) => utf8Length(value) <= MAX_PASSWORD_BYTES,
    `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer.`
  );

export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required.")
  .max(MAX_PASSWORD_CHARS, "Password must be 128 characters or fewer.")
  .refine(
    (value) => utf8Length(value) <= MAX_PASSWORD_BYTES,
    `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer.`
  );

export const signupSchema = z
  .object({
    name: signupNameSchema,
    email: emailSchema,
    password: signupPasswordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const chatRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Message is required.")
      .max(2_000, "Message must be 2000 characters or fewer."),
  })
  .strict();

export const MAX_ANALYSIS_INPUT_CHARS = 30_000;
export const MAX_ANALYSIS_OUTPUT_CHARS = 24_000;

export function parseAnalysisInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ANALYSIS_INPUT_CHARS) return null;
  return trimmed;
}

export function firstValidationMessage(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export function validateSignupInput(input: unknown): { valid: boolean; error?: string } {
  const result = signupSchema.safeParse(input);
  if (result.success) return { valid: true };
  return { valid: false, error: firstValidationMessage(result.error, "Please check your signup details.") };
}
