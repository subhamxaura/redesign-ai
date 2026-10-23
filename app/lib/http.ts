import { isIP } from "net";
import { InvalidRequestError, PayloadTooLargeError } from "@/app/lib/errors";

export const MAX_JSON_BYTES = 16 * 1024;
export const MAX_UPLOAD_FORM_BYTES = 12 * 1024 * 1024;

function parseContentLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function assertContentLengthWithin(request: Request, maxBytes: number): void {
  const length = parseContentLength(request);
  if (length !== null && length > maxBytes) {
    throw new PayloadTooLargeError();
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_JSON_BYTES
): Promise<unknown> {
  assertContentLengthWithin(request, maxBytes);

  if (!request.body) {
    throw new InvalidRequestError("Request body is required.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (exceeded) throw new PayloadTooLargeError();

  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidRequestError("Invalid JSON body.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidRequestError("Invalid JSON body.");
  }
}

export async function readFormDataWithLimit(
  request: Request,
  maxBytes: number = MAX_UPLOAD_FORM_BYTES
): Promise<FormData> {
  assertContentLengthWithin(request, maxBytes);

  if (!request.body) {
    throw new InvalidRequestError("Request body is required.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (exceeded) throw new PayloadTooLargeError();

  const contentType = request.headers.get("content-type");
  if (!contentType) {
    throw new InvalidRequestError("Content-Type must be multipart/form-data.");
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);

  try {
    return await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new InvalidRequestError("Invalid multipart form data.");
  }
}

function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^"|"$/g, "");
  if (!value) return null;

  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close > 0) value = value.slice(1, close);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  value = value.replace(/^::ffff:/i, "");
  return isIP(value) ? value : null;
}

/**
 * Reject cross-origin state-changing requests. Requests without Origin and
 * Sec-Fetch-Site (server-to-server, curl) are allowed; browser cross-origin
 * requests are not.
 */
export function assertSameOrigin(request: Request): void {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new InvalidRequestError("Cross-origin requests are not allowed.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new InvalidRequestError("Cross-origin requests are not allowed.");
  }

  const hosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].filter((value): value is string => !!value);

  if (!hosts.some((host) => originHost.toLowerCase() === host.toLowerCase())) {
    throw new InvalidRequestError("Cross-origin requests are not allowed.");
  }
}

/**
 * Rate-limit identity. Prefer the validated client IP; when no trusted proxy
 * is configured, fall back to non-secret request hints so all clients are not
 * collapsed into a single global bucket. This fallback is spoofable and is not
 * a substitute for configuring a trusted proxy.
 */
export function getRateLimitIdentity(request: Request): string {
  const ip = getClientIp(request);
  if (ip) return `ip:${ip}`;

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const language = (request.headers.get("accept-language") ?? "").slice(0, 80);
  return `fp:${userAgent}|${language}`;
}

/**
 * Best-effort client IP extraction.
 *
 * - `x-vercel-forwarded-for` is trusted only when running on Vercel.
 * - Other proxy headers are trusted only when TRUST_PROXY_HEADERS=true, because
 *   arbitrary clients can spoof them when no trusted proxy overwrites them.
 */
export function getClientIp(request: Request): string | null {
  // Only trust the Vercel-controlled header on Vercel. On self-hosted servers
  // arbitrary clients can set this header themselves.
  if (process.env.VERCEL === "1") {
    const vercelIp = normalizeIp(
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? null
    );
    if (vercelIp) return vercelIp;
  }

  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const realIp = normalizeIp(request.headers.get("x-real-ip"));
    if (realIp) return realIp;

    const forwardedIp = normalizeIp(request.headers.get("x-forwarded-for")?.split(",")[0] ?? null);
    if (forwardedIp) return forwardedIp;
  }

  return null;
}
