import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { AppError, ConfigurationError, logServerError } from "@/app/lib/errors";

/**
 * Centralized Gemini model configuration.
 * All server routes must import from here - never hard-code a model ID elsewhere.
 */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

export const GEMINI_STRUCTURED_MODEL =
  process.env.GEMINI_STRUCTURED_MODEL?.trim() || GEMINI_MODEL;

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const MIN_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;
const MAX_AI_RESPONSE_CHARS = 100_000;

export function getGeminiRequestTimeoutMs(): number {
  const configured = Number.parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.max(MIN_REQUEST_TIMEOUT_MS, Math.min(MAX_REQUEST_TIMEOUT_MS, configured));
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new ConfigurationError(new Error("GEMINI_API_KEY is not configured."));
  }

  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Retry / timeout / public error handling
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const obj = error as Record<string, unknown>;

  if (typeof obj.status === "number") return obj.status;
  if (typeof obj.code === "number") return obj.code;
  if (typeof obj.statusCode === "number") return obj.statusCode;

  const nested = obj.error as Record<string, unknown> | undefined;
  if (nested) {
    if (typeof nested.status === "number") return nested.status;
    if (typeof nested.code === "number") return nested.code;
    if (typeof nested.statusCode === "number") return nested.statusCode;
    if (typeof nested.status === "string") {
      const status = nested.status.toUpperCase();
      if (status === "UNAVAILABLE") return 503;
      if (status === "RESOURCE_EXHAUSTED") return 429;
      if (status === "NOT_FOUND") return 404;
      if (status === "UNAUTHENTICATED" || status === "PERMISSION_DENIED") return 401;
    }
  }

  for (const key of ["status", "code"]) {
    const value = obj[key];
    if (typeof value === "string") {
      const upper = value.toUpperCase();
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

function isAbortOrTimeout(error: unknown): boolean {
  return (
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) ||
    (typeof error === "object" &&
      error !== null &&
      (error as Record<string, unknown>).name === "TimeoutError")
  );
}

export function isRetryableGeminiError(error: unknown): boolean {
  if (isAbortOrTimeout(error)) return false;

  const status = extractStatus(error);
  if (status === 429 || status === 503) return true;

  const message = extractMessage(error).toLowerCase();
  if (!message) return false;

  if (message.includes("503") || message.includes("429")) return true;
  if (message.includes("unavailable")) return true;
  if (message.includes("resource_exhausted")) return true;
  if (message.includes("resource exhausted")) return true;
  if (message.includes("overloaded")) return true;
  if (message.includes("temporarily unavailable")) return true;

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
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 600;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isRetryableGeminiError(error)) throw error;

      const exponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 200);
      let retryAfterMs: number | null = null;

      if (typeof error === "object" && error !== null) {
        const headers = (error as Record<string, unknown>).headers as Record<string, string> | undefined;
        const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
        if (typeof retryAfter === "string") {
          const seconds = Number.parseInt(retryAfter, 10);
          if (!Number.isNaN(seconds)) retryAfterMs = Math.min(seconds * 1000, 10_000);
        }
      }

      await sleep(retryAfterMs ?? exponential + jitter);
    }
  }

  throw lastError;
}

function publicGeminiError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  logServerError("gemini", error);

  if (isAbortOrTimeout(error)) {
    return new AppError(504, "The AI service took too long to respond. Please try again.");
  }

  const status = extractStatus(error);
  if (status === 429) {
    return new AppError(429, "AI is experiencing high demand. Please wait a moment and try again.", {
      retryAfterSeconds: 30,
    });
  }
  if (status === 503) {
    return new AppError(503, "AI service is temporarily overloaded. Please try again shortly.", {
      retryAfterSeconds: 30,
    });
  }
  if (status === 401 || status === 403) {
    return new AppError(503, "AI service is temporarily unavailable. Please try again later.");
  }
  if (status === 404) {
    return new AppError(502, "The AI model is temporarily unavailable. Please try again later.");
  }

  return new AppError(502, "The AI service could not complete the request. Please try again.");
}

type GeminiClient = ReturnType<typeof getGeminiClient>;

export async function generateGeminiContent(
  client: GeminiClient,
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  const timeoutMs = getGeminiRequestTimeoutMs();

  try {
    return await withGeminiRetry(() =>
      client.models.generateContent({
        ...params,
        config: {
          ...params.config,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      })
    );
  } catch (error) {
    throw publicGeminiError(error);
  }
}

export function readGeminiResponseText(
  response: GenerateContentResponse,
  maxChars: number = MAX_AI_RESPONSE_CHARS
): string {
  const text = response.text?.trim();
  if (!text) {
    throw new AppError(502, "The AI service returned an empty response. Please try again.");
  }
  if (text.length > maxChars) {
    throw new AppError(502, "The AI service returned an oversized response.");
  }
  return text;
}

/**
 * Wrap user- or model-supplied text in explicit delimiters so the model can
 * distinguish instructions from untrusted content. Any attempt to spoof the
 * delimiter is removed.
 */
export function asUntrustedPromptBlock(
  label: string,
  text: string,
  maxChars: number
): string {
  const safeLabel = /^[a-z_]{1,32}$/.test(label) ? label : "content";
  const cleaned = text
    .replace(/\u0000/g, "")
    .replace(/<\s*\/?\s*untrusted_[a-z_]+\s*>/gi, "[removed delimiter]")
    .slice(0, maxChars);

  return `<untrusted_${safeLabel}>\n${cleaned}\n</untrusted_${safeLabel}>`;
}
