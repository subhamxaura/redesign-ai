import { createHmac } from "crypto";
import { getAuthSecret } from "@/app/lib/authSecret";
import {
  assertDurableStorage,
  fileReadJson,
  fileWriteJson,
  handleStorageFailure,
  isRedisConfigured,
  redisExpire,
  redisIncr,
  redisTtl,
  withFileLock,
} from "@/app/lib/store";

const RATE_LIMIT_FILE = "rate-limits.json";
const MAX_TRACKED_FILE_ENTRIES = 5_000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitBucket = {
  key: string;
  limit: number;
  windowSeconds: number;
};

function hashKey(key: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`rate-limit:v1:${key}`)
    .digest("hex")
    .slice(0, 40);
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(10_000, Math.floor(limit)));
}

function clampWindow(windowSeconds: number): number {
  return Math.max(1, Math.min(7 * 24 * 60 * 60, Math.floor(windowSeconds)));
}

function retryAfter(resetAt: number, fallbackSeconds: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000) || fallbackSeconds);
}

export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitBucket): Promise<RateLimitResult> {
  assertDurableStorage();

  const max = clampLimit(limit);
  const window = clampWindow(windowSeconds);
  const storageKey = `rdai:rl:${hashKey(key)}`;

  if (isRedisConfigured()) {
    try {
      const count = await redisIncr(storageKey);
      const ttl = await redisTtl(storageKey);
      const effectiveTtl = ttl > 0 ? ttl : window;

      // Repair keys that lost their TTL (e.g. a transient EXPIRE failure) so
      // a rate-limit key can never become permanent.
      if (ttl <= 0) {
        await redisExpire(storageKey, window);
      }
      return {
        allowed: count <= max,
        limit: max,
        remaining: Math.max(0, max - count),
        retryAfterSeconds: effectiveTtl,
      };
    } catch (error) {
      handleStorageFailure("rate limit", error);
    }
  }

  return withFileLock("rate-limits", async () => {
    const now = Date.now();
    const all = await fileReadJson<Record<string, RateLimitEntry>>(RATE_LIMIT_FILE, {});
    const current = all[storageKey];

    if (!current || current.resetAt <= now) {
      all[storageKey] = { count: 1, resetAt: now + window * 1000 };
      await pruneAndWrite(all, now);
      return {
        allowed: true,
        limit: max,
        remaining: max - 1,
        retryAfterSeconds: window,
      };
    }

    const nextCount = current.count + 1;
    all[storageKey] = { count: nextCount, resetAt: current.resetAt };
    await pruneAndWrite(all, now);

    return {
      allowed: nextCount <= max,
      limit: max,
      remaining: Math.max(0, max - nextCount),
      retryAfterSeconds: retryAfter(current.resetAt, window),
    };
  });
}

async function pruneAndWrite(all: Record<string, RateLimitEntry>, now: number): Promise<void> {
  const entries = Object.entries(all);
  if (entries.length <= MAX_TRACKED_FILE_ENTRIES) {
    await fileWriteJson(RATE_LIMIT_FILE, all);
    return;
  }

  const kept = entries
    .filter(([, entry]) => entry.resetAt > now)
    .sort((a, b) => b[1].resetAt - a[1].resetAt)
    .slice(0, MAX_TRACKED_FILE_ENTRIES);

  await fileWriteJson(RATE_LIMIT_FILE, Object.fromEntries(kept));
}

/**
 * Enforce several buckets in sequence. Every bucket must allow the request.
 * A rejected bucket stops evaluation so later buckets are not incremented.
 */
export async function enforceRateLimits(
  buckets: RateLimitBucket[]
): Promise<RateLimitResult | null> {
  for (const bucket of buckets) {
    const result = await rateLimit(bucket);
    if (!result.allowed) return result;
  }
  return null;
}
