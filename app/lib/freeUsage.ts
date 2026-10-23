// Centralized anonymous free-use gate. ALL redesign-generation counting
// MUST go through this module so one user action = exactly +1 usage.
//
// Design:
// - Authenticated users bypass the gate entirely (unlimited).
// - Anonymous browsers receive a server-signed ID in an HttpOnly cookie
//   (`rdai_anon`). The cookie identifies the browser; it is never trusted as
//   an authoritative usage count.
// - Usage is stored server-side (Upstash Redis in production, durable file in
//   development). The server is the sole authority on remaining uses.
// - A second server-side bucket is keyed by a keyed hash of the client IP.
//   Clearing the cookie creates a new identity but cannot exceed the larger
//   network bucket. Raw IPs are never stored.
// - Counting uses reserve-before-work + refund-on-failure so failed
//   generations are not counted and concurrent requests cannot exceed limits.
// - Enforced ONLY at completed-generation endpoints (/api/generate,
//   /api/redesign). /api/analyze is deliberately NOT counted.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getAuthSecret } from "@/app/lib/authSecret";
import { logServerError } from "@/app/lib/errors";
import {
  assertDurableStorage,
  fileReadJson,
  fileWriteJson,
  handleStorageFailure,
  isRedisConfigured,
  redisDecr,
  redisExpire,
  redisGet,
  redisIncr,
  redisSet,
  redisTtl,
  withFileLock,
} from "@/app/lib/store";

export const FREE_LIMIT = 3;
export const ANON_COOKIE = "rdai_anon";

const ANON_TTL_SECONDS = 365 * 24 * 60 * 60;
const NETWORK_TTL_SECONDS = 30 * 24 * 60 * 60;
const ANON_TTL_MS = ANON_TTL_SECONDS * 1000;
const NETWORK_TTL_MS = NETWORK_TTL_SECONDS * 1000;
const USAGE_FILE = "anon-usage.json";
const NETWORK_LOCK = "anon-usage";

function readNetworkFreeLimit(): number {
  const configured = Number.parseInt(process.env.ANON_NETWORK_FREE_LIMIT ?? "", 10);
  if (!Number.isFinite(configured)) return 12;
  return Math.max(FREE_LIMIT, Math.min(100, configured));
}

export const NETWORK_FREE_LIMIT = readNetworkFreeLimit();

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function anonKey(anonId: string): string {
  return `rdai:anon:${anonId}`;
}

function networkKey(hash: string): string {
  return `rdai:anon-net:${hash}`;
}

function signAnonId(anonId: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`anon-cookie:v1:${anonId}`)
    .digest("base64url");
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

export function buildAnonCookieValue(anonId: string): string {
  return `${anonId}.${signAnonId(anonId)}`;
}

export function parseAnonCookieValue(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length > 160) return null;

  const separator = raw.lastIndexOf(".");
  if (separator <= 0 || separator === raw.length - 1) return null;

  const anonId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!isValidAnonId(anonId) || signature.length < 16 || signature.length > 128) return null;

  const expected = Buffer.from(signAnonId(anonId), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length) return null;

  return timingSafeEqual(expected, provided) ? anonId : null;
}

/** Parse and verify the anonymous ID from a raw Cookie header. */
export function getAnonIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    const name = part.slice(0, index).trim();
    if (name !== ANON_COOKIE) continue;

    const rawValue = part.slice(index + 1).trim().replace(/^"|"$/g, "");
    if (rawValue.length > 512) return null;

    let decoded: string;
    try {
      decoded = decodeURIComponent(rawValue);
    } catch {
      return null;
    }

    return parseAnonCookieValue(decoded);
  }

  return null;
}

/** Keyed, non-reversible network bucket derived from a validated client IP. */
export function networkKeyForIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  return createHmac("sha256", getAuthSecret())
    .update(`anon-network:v1:${ip}`)
    .digest("hex")
    .slice(0, 40);
}

/** Cookie attributes: HttpOnly, Secure in prod, SameSite=Lax, 1-year expiry. */
export function buildAnonCookie(anonId: string): string {
  const attributes = [
    `${ANON_COOKIE}=${encodeURIComponent(buildAnonCookieValue(anonId))}`,
    "Path=/",
    `Max-Age=${ANON_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd()) attributes.push("Secure");
  return attributes.join("; ");
}

export function applyAnonCookie(res: Response, anonId: string): void {
  res.headers.append("Set-Cookie", buildAnonCookie(anonId));
}

// ---------------------------------------------------------------------------
// Server-side usage records
// ---------------------------------------------------------------------------

type FileCounter = { count: number; expiresAt: number };

function readStoredCounter(value: unknown, now: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.min(Math.floor(value), 1_000_000);
  }

  if (typeof value !== "object" || value === null) return 0;
  const counter = value as Record<string, unknown>;
  if (
    typeof counter.count !== "number" ||
    !Number.isFinite(counter.count) ||
    counter.count < 0 ||
    typeof counter.expiresAt !== "number" ||
    counter.expiresAt <= now
  ) {
    return 0;
  }

  return Math.min(Math.floor(counter.count), 1_000_000);
}

function nextStoredCounter(
  previous: unknown,
  count: number,
  ttlMs: number,
  now: number
): FileCounter {
  const existingExpiry =
    typeof previous === "object" &&
    previous !== null &&
    typeof (previous as Record<string, unknown>).expiresAt === "number"
      ? ((previous as Record<string, unknown>).expiresAt as number)
      : null;

  return {
    count,
    expiresAt:
      existingExpiry !== null && Number.isFinite(existingExpiry) && existingExpiry > now
        ? existingExpiry
        : now + ttlMs,
  };
}

function pruneExpiredCounters(all: Record<string, unknown>, now: number): void {
  for (const [key, value] of Object.entries(all)) {
    if (typeof value === "number") {
      // Legacy unsigned-cookie counters are unreachable after cookie signing.
      delete all[key];
      continue;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).expiresAt === "number" &&
      ((value as Record<string, unknown>).expiresAt as number) <= now
    ) {
      delete all[key];
    }
  }
}

async function readCounter(key: string): Promise<number> {
  if (isRedisConfigured()) {
    try {
      const raw = await redisGet(key);
      const parsed = raw == null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 1_000_000) : 0;
    } catch (error) {
      handleStorageFailure("usage read", error);
    }
  }

  const all = await fileReadJson<Record<string, unknown>>(USAGE_FILE, {});
  return readStoredCounter(all[key], Date.now());
}

export async function getFreeUsage(anonId: string): Promise<{
  usage: number;
  remaining: number;
  limit: number;
}> {
  assertDurableStorage();
  const usage = await readCounter(anonKey(anonId));
  return { usage, remaining: Math.max(0, FREE_LIMIT - usage), limit: FREE_LIMIT };
}

export type FreeUseReservation = {
  allowed: boolean;
  usage: number;
  remaining: number;
  limit: number;
};

const DENIED_RESERVATION: FreeUseReservation = {
  allowed: false,
  usage: FREE_LIMIT,
  remaining: 0,
  limit: FREE_LIMIT,
};

/**
 * Atomically reserve one use BEFORE doing expensive Gemini work.
 * Callers MUST call refundFreeUse() if generation later fails.
 */
export async function reserveFreeUse(
  anonId: string,
  networkHash: string | null = null
): Promise<FreeUseReservation> {
  assertDurableStorage();

  const anonStorageKey = anonKey(anonId);
  const networkStorageKey = networkHash ? networkKey(networkHash) : null;

  if (isRedisConfigured()) {
    let cookieUsage: number | null = null;
    try {
      cookieUsage = await redisIncr(anonStorageKey);
    } catch (error) {
      // Throws in production. In development, fall through to the file store.
      handleStorageFailure("free-use reservation", error);
    }

    if (cookieUsage !== null) {
      if (cookieUsage === 1) {
        await redisExpire(anonStorageKey, ANON_TTL_SECONDS).catch((error) => {
          logServerError("free-use cookie TTL", error);
        });
      } else {
        // Repair a missing TTL so a transient EXPIRE failure cannot create a
        // permanent per-browser counter.
        const ttl = await redisTtl(anonStorageKey).catch(() => 1);
        if (ttl <= 0) {
          await redisExpire(anonStorageKey, ANON_TTL_SECONDS).catch((error) => {
            logServerError("free-use cookie TTL repair", error);
          });
        }
      }

      if (cookieUsage > FREE_LIMIT) {
        await redisDecr(anonStorageKey).catch(() => {});
        return DENIED_RESERVATION;
      }

      if (networkStorageKey) {
        let networkUsage: number | null = null;
        try {
          networkUsage = await redisIncr(networkStorageKey);
        } catch (error) {
          await redisDecr(anonStorageKey).catch(() => {});
          handleStorageFailure("free-use network reservation", error);
        }

        if (networkUsage !== null) {
          if (networkUsage === 1) {
            await redisExpire(networkStorageKey, NETWORK_TTL_SECONDS).catch((error) => {
              logServerError("free-use network TTL", error);
            });
          } else {
            const ttl = await redisTtl(networkStorageKey).catch(() => 1);
            if (ttl <= 0) {
              await redisExpire(networkStorageKey, NETWORK_TTL_SECONDS).catch((error) => {
                logServerError("free-use network TTL repair", error);
              });
            }
          }

          if (networkUsage > NETWORK_FREE_LIMIT) {
            await redisDecr(networkStorageKey).catch(() => {});
            await redisDecr(anonStorageKey).catch(() => {});
            return DENIED_RESERVATION;
          }

          return {
            allowed: true,
            usage: cookieUsage,
            remaining: Math.max(0, FREE_LIMIT - cookieUsage),
            limit: FREE_LIMIT,
          };
        }
      } else {
        return {
          allowed: true,
          usage: cookieUsage,
          remaining: Math.max(0, FREE_LIMIT - cookieUsage),
          limit: FREE_LIMIT,
        };
      }
    }
  }

  return withFileLock(NETWORK_LOCK, async () => {
    const now = Date.now();
    const all = await fileReadJson<Record<string, unknown>>(USAGE_FILE, {});
    const cookieRecord = all[anonStorageKey];
    const networkRecord = networkStorageKey ? all[networkStorageKey] : undefined;
    const cookieUsage = readStoredCounter(cookieRecord, now);
    const networkUsage = networkStorageKey ? readStoredCounter(networkRecord, now) : 0;

    if (cookieUsage >= FREE_LIMIT || (networkStorageKey && networkUsage >= NETWORK_FREE_LIMIT)) {
      return DENIED_RESERVATION;
    }

    const nextUsage = cookieUsage + 1;
    all[anonStorageKey] = nextStoredCounter(cookieRecord, nextUsage, ANON_TTL_MS, now);
    if (networkStorageKey) {
      all[networkStorageKey] = nextStoredCounter(
        networkRecord,
        networkUsage + 1,
        NETWORK_TTL_MS,
        now
      );
    }
    pruneExpiredCounters(all, now);
    await fileWriteJson(USAGE_FILE, all);

    return {
      allowed: true,
      usage: nextUsage,
      remaining: Math.max(0, FREE_LIMIT - nextUsage),
      limit: FREE_LIMIT,
    };
  });
}

/** Refund a reservation when generation fails. */
export async function refundFreeUse(
  anonId: string,
  networkHash: string | null = null
): Promise<void> {
  assertDurableStorage();

  const anonStorageKey = anonKey(anonId);
  const networkStorageKey = networkHash ? networkKey(networkHash) : null;

  if (isRedisConfigured()) {
    let anonRefunded = false;
    try {
      const next = await redisDecr(anonStorageKey);
      if (next < 0) await redisSet(anonStorageKey, "0");
      anonRefunded = true;

      if (networkStorageKey) {
        const networkNext = await redisDecr(networkStorageKey);
        if (networkNext < 0) await redisSet(networkStorageKey, "0");
      }
      return;
    } catch (error) {
      handleStorageFailure("free-use refund", error);
    }

    // Never double-decrement through the file store after a partial Redis
    // refund. Leaving the network bucket counted is the safer failure mode.
    if (anonRefunded) return;
  }

  await withFileLock(NETWORK_LOCK, async () => {
    const now = Date.now();
    const all = await fileReadJson<Record<string, unknown>>(USAGE_FILE, {});
    const cookieRecord = all[anonStorageKey];
    const cookieUsage = readStoredCounter(cookieRecord, now);
    if (cookieUsage > 0) {
      all[anonStorageKey] = nextStoredCounter(cookieRecord, cookieUsage - 1, ANON_TTL_MS, now);
    }

    if (networkStorageKey) {
      const networkRecord = all[networkStorageKey];
      const networkUsage = readStoredCounter(networkRecord, now);
      if (networkUsage > 0) {
        all[networkStorageKey] = nextStoredCounter(
          networkRecord,
          networkUsage - 1,
          NETWORK_TTL_MS,
          now
        );
      }
    }

    pruneExpiredCounters(all, now);
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
