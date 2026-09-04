import { GoogleGenAI } from "@google/genai";

const MAX_IMAGE_SIZE_MB = 10;
const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Centralized Gemini model configuration.
 * All server routes must import from here — never hard-code a model ID elsewhere.
 * Defaults to gemini-3.6-flash (current production model).
 */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

export const GEMINI_STRUCTURED_MODEL =
  process.env.GEMINI_STRUCTURED_MODEL?.trim() || GEMINI_MODEL;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to .env.local and restart the server."
    );
  }

  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Retry / error handling
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const obj = error as Record<string, unknown>;

  // Direct
  if (typeof obj.status === "number") return obj.status;
  if (typeof obj.code === "number") return obj.code;
  if (typeof obj.statusCode === "number") return obj.statusCode;

  // Nested error.error
  const nested = obj.error as Record<string, unknown> | undefined;
  if (nested) {
    if (typeof nested.status === "number") return nested.status;
    if (typeof nested.code === "number") return nested.code;
    if (typeof nested.statusCode === "number") return nested.statusCode;
    // Google API sometimes returns string status like "UNAVAILABLE"
    if (typeof nested.status === "string") {
      const s = nested.status.toUpperCase();
      if (s === "UNAVAILABLE") return 503;
      if (s === "RESOURCE_EXHAUSTED") return 429;
      if (s === "NOT_FOUND") return 404;
      if (s === "UNAUTHENTICATED" || s === "PERMISSION_DENIED") return 401;
    }
    if (typeof nested.code === "string") {
      const c = nested.code.toUpperCase();
      if (c === "UNAVAILABLE") return 503;
      if (c === "RESOURCE_EXHAUSTED") return 429;
    }
  }

  // String status/code fields
  for (const key of ["status", "code"]) {
    const v = obj[key];
    if (typeof v === "string") {
      const upper = v.toUpperCase();
      if (upper === "UNAVAILABLE") return 503;
      if (upper === "RESOURCE_EXHAUSTED") return 429;
    }
  }

  return null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    const nested = obj.error as Record<string, unknown> | undefined;
    if (nested && typeof nested.message === "string") return nested.message;
  }
  return "";
}

export function isRetryableGeminiError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 429 || status === 503) return true;

  const msg = extractMessage(error).toLowerCase();
  if (!msg) return false;

  // Retry on transient overload / rate-limit signals even when status is missing
  if (msg.includes("503") || msg.includes("429")) return true;
  if (msg.includes("unavailable")) return true;
  if (msg.includes("resource_exhausted")) return true;
  if (msg.includes("resource exhausted")) return true;
  if (msg.includes("overloaded")) return true;
  if (msg.includes("try again")) return true;
  if (msg.includes("temporarily unavailable")) return true;

  return false;
}

/**
 * Execute a Gemini request with finite exponential-backoff retries for
 * transient 429 / 503 errors. Never loops infinitely.
 */
export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isRetryableGeminiError(error)) {
        throw error;
      }

      // Exponential backoff with jitter: 500ms, 1s, 2s...
      const exponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 200);
      const delay = exponential + jitter;

      // Respect Retry-After header if present on the error
      let retryAfterMs: number | null = null;
      if (typeof error === "object" && error !== null) {
        const headers = (error as Record<string, unknown>).headers as
          | Record<string, string>
          | undefined;
        const retryAfter =
          headers?.["retry-after"] ?? headers?.["Retry-After"];
        if (typeof retryAfter === "string") {
          const secs = Number.parseInt(retryAfter, 10);
          if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
        }
      }

      await sleep(retryAfterMs ?? delay);
    }
  }

  throw lastError;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const status = extractStatus(error);
  const rawMessage = extractMessage(error);

  // Never echo secrets — strip anything that looks like an API key
  const sanitized = rawMessage.replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED]");

  // Map known Gemini errors to user-friendly messages
  if (status === 404 || sanitized.toLowerCase().includes("is no longer available")) {
    return "The AI model is temporarily unavailable. Please try again in a moment.";
  }
  if (status === 429 || sanitized.toLowerCase().includes("resource_exhausted") || sanitized.toLowerCase().includes("429")) {
    return "AI is experiencing high demand. Please wait a moment and try again.";
  }
  if (status === 503 || sanitized.toLowerCase().includes("503") || sanitized.toLowerCase().includes("unavailable") || sanitized.toLowerCase().includes("overloaded")) {
    return "AI service is temporarily overloaded. Please try again shortly.";
  }
  if (status === 401 || status === 403 || sanitized.toLowerCase().includes("api_key") && sanitized.toLowerCase().includes("invalid")) {
    return "AI service authentication failed. Please check the server configuration.";
  }

  // If we have a concise sanitized message without internal paths/secrets, surface it
  if (sanitized && sanitized.length < 300 && !sanitized.includes("GEMINI_API_KEY")) {
    // Hide verbose stack-like internals
    if (!sanitized.includes("at ") || sanitized.length < 120) {
      return sanitized;
    }
  }

  return fallback;
}

type ImageValidationResult =
  | {
      ok: true;
      file: File;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export function validateImageUpload(
  value: FormDataEntryValue | null
): ImageValidationResult {
  if (!(value instanceof File)) {
    return {
      ok: false,
      error: "No image uploaded.",
      status: 400,
    };
  }

  if (!allowedImageTypes.has(value.type)) {
    return {
      ok: false,
      error: "Please upload a PNG, JPG, or WEBP image.",
      status: 400,
    };
  }

  if (value.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return {
      ok: false,
      error: `Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB.`,
      status: 400,
    };
  }

  return {
    ok: true,
    file: value,
  };
}

export async function fileToInlineData(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  return {
    inlineData: {
      mimeType: file.type,
      data: Buffer.from(arrayBuffer).toString("base64"),
    },
  };
}
