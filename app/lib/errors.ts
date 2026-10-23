export class AppError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, options?: { cause?: unknown; retryAfterSeconds?: number }) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export class ConfigurationError extends AppError {
  constructor(cause?: unknown) {
    super(503, "Service is temporarily unavailable. Please try again later.", { cause });
    this.name = "ConfigurationError";
  }
}

export class StorageUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super(503, "Service is temporarily unavailable. Please try again later.", { cause });
    this.name = "StorageUnavailableError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, "The request is too large.");
    this.name = "PayloadTooLargeError";
  }
}

export class InvalidRequestError extends AppError {
  constructor(message = "Invalid request body.") {
    super(400, message);
    this.name = "InvalidRequestError";
  }
}

export type PublicError = {
  status: number;
  message: string;
  retryAfterSeconds?: number;
};

const MAX_LOG_MESSAGE_LENGTH = 500;

export function redactSecrets(value: string): string {
  return value
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:key|token|api[_-]?key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]");
}

export function logServerError(context: string, error: unknown): void {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const name = error instanceof Error ? error.name : typeof record.name === "string" ? record.name : "Error";
  const code =
    typeof record.code === "string" || typeof record.code === "number"
      ? String(record.code)
      : typeof record.status === "number"
        ? String(record.status)
        : undefined;
  const rawMessage = error instanceof Error ? error.message : typeof record.message === "string" ? record.message : "";
  const message = redactSecrets(rawMessage).replace(/[\r\n]+/g, " ").slice(0, MAX_LOG_MESSAGE_LENGTH);

  console.error(`[${context}] ${name}${code ? ` (${code})` : ""}: ${message || "unknown error"}`);
}

export function toPublicError(error: unknown, fallback: string): PublicError {
  if (error instanceof AppError) {
    if (error.status >= 500) logServerError("app", error);
    return {
      status: error.status,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }

  logServerError("app", error);
  return { status: 500, message: fallback };
}
