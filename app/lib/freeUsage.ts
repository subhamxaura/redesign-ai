// Centralized anonymous free-use gate. ALL redesign-generation counting
// MUST go through this module so one user action = exactly +1 usage.
//
// Design:
// - Authenticated users bypass the gate entirely (unlimited).
// - Anonymous browsers get a secure random ID stored in an HttpOnly cookie
//   (`rdai_anon`). The cookie is ONLY an identifier — the usage COUNT lives
//   server-side (Upstash Redis on Vercel, JSON file locally) and the server
//   is the sole authority on remaining uses.
// - Counting uses reserve-before-work + refund-on-failure so:
//     * failed/validation/cancelled/Gemini-error generations are NOT counted
//     * concurrent double-clicks cannot exceed the limit (atomic INCR + cap)
// - Enforced ONLY at completed-generation endpoints (/api/generate,
//   /api/redesign). /api/analyze is deliberately NOT counted.

import { randomUUID } from "crypto";
import {
  fileReadJson,
  fileWriteJson,
  isRedisConfigured,
  redisDecr,
  redisExpire,
  redisGet,
  redisIncr,
  redisSet,
  withFileLock,
} from "@/app/lib/store";

export const FREE_LIMIT = 3;
export const ANON_COOKIE = "rdai_anon";
const ANON_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year
const USAGE_FILE = "anon-usage.json";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function anonKey(anonId: string): string {
  return `rdai:anon:${anonId}`;
}

export function isValidAnonId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function newAnonId(): string {
  return randomUUID().replace(/-/g, "");
}

/** Parse the anonymous ID from a raw Cookie header (server is authoritative). */
export function getAnonIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name !== ANON_COOKIE) continue;
    const raw = decodeURIComponent(part.slice(idx + 1).trim().replace(/^"|"$/g, ""));
    if (isValidAnonId(raw)) return raw;
    return null;
  }
  return null;
}

/** Cookie attributes: HttpOnly, Secure in prod, SameSite=Lax, 1-year expiry. */
export function buildAnonCookie(anonId: string): string {
  const attrs = [
    `${ANON_COOKIE}=${encodeURIComponent(anonId)}`,
    "Path=/",
    `Max-Age=${ANON_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd()) attrs.push("Secure");
  return attrs.join("; ");
}

export function applyAnonCookie(res: Response, anonId: string): void {
  res.headers.append("Set-Cookie", buildAnonCookie(anonId));
}

// ---------------------------------------------------------------------------
// Server-side usage record
// ---------------------------------------------------------------------------

async function readUsage(anonId: string): Promise<number> {
  if (isRedisConfigured()) {
    try {
      const raw = await redisGet(anonKey(anonId));
      const n = raw == null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, 1_000_000) : 0;
    } catch (err) {
      console.error("Redis usage read failed, falling back to file:", err);
    }
  }
  const all = await fileReadJson<Record<string, number>>(USAGE_FILE, {});
  const n = all[anonId];
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function getFreeUsage(anonId: string): Promise<{
  usage: number;
  remaining: number;
  limit: number;
}> {
  const usage = await readUsage(anonId);
  return { usage, remaining: Math.max(0, FREE_LIMIT - usage), limit: FREE_LIMIT };
}

/**
 * Atomically reserve one use BEFORE doing expensive Gemini work.
 * Returns allowed=false when the limit is already reached (or the race was
 * lost). Callers MUST call refundFreeUse() if generation later fails so
 * failures are never counted.
 */
export async function reserveFreeUse(
  anonId: string
): Promise<{ allowed: boolean; usage: number; remaining: number; limit: number }> {
  if (isRedisConfigured()) {
    try {
      const next = await redisIncr(anonKey(anonId));
      // Best-effort TTL so stale anonymous keys expire.
      if (next === 1) await redisExpire(anonKey(anonId), ANON_TTL_SECONDS);
      if (next > FREE_LIMIT) {
        await redisDecr(anonKey(anonId)); // roll back — over-limit never counts
        return { allowed: false, usage: FREE_LIMIT, remaining: 0, limit: FREE_LIMIT };
      }
      return { allowed: true, usage: next, remaining: FREE_LIMIT - next, limit: FREE_LIMIT };
    } catch (err) {
      console.error("Redis reserve failed, falling back to file:", err);
    }
  }
  return withFileLock(`usage:${anonId}`, async () => {
    const all = await fileReadJson<Record<string, number>>(USAGE_FILE, {});
    const current = typeof all[anonId] === "number" ? all[anonId] : 0;
    if (current >= FREE_LIMIT) {
      return { allowed: false, usage: current, remaining: 0, limit: FREE_LIMIT };
    }
    const next = current + 1;
    all[anonId] = next;
    await fileWriteJson(USAGE_FILE, all);
    return { allowed: true, usage: next, remaining: FREE_LIMIT - next, limit: FREE_LIMIT };
  });
}

/** Refund a reservation when generation fails validation/cancel/Gemini error. */
export async function refundFreeUse(anonId: string): Promise<void> {
  if (isRedisConfigured()) {
    try {
      const next = await redisDecr(anonKey(anonId));
      if (next < 0) await redisSet(anonKey(anonId), "0");
      return;
    } catch (err) {
      console.error("Redis refund failed, falling back to file:", err);
    }
  }
  await withFileLock(`usage:${anonId}`, async () => {
    const all = await fileReadJson<Record<string, number>>(USAGE_FILE, {});
    const current = typeof all[anonId] === "number" ? all[anonId] : 0;
    all[anonId] = Math.max(0, current - 1);
    await fileWriteJson(USAGE_FILE, all);
  });
}

export function limitReachedResponse(usage: number) {
  return {
    error: "FREE_LIMIT_REACHED" as const,
    message: "Your 3 free redesigns are complete. Create a free account to keep redesigning.",
    usage,
    remaining: 0,
    limit: FREE_LIMIT,
  };
}
