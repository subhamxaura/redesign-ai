// Server-only persistent key-value layer.
// Prefers Upstash Redis (REST) when configured — required for correct
// behavior on Vercel serverless (many instances, ephemeral filesystem).
// Falls back to a local JSON file + in-memory cache for local development.
//
// Required Vercel env vars for production persistence:
//   UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=<token>

import { promises as fs } from "fs";
import path from "path";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

export function isRedisConfigured(): boolean {
  return !!REDIS_URL && !!REDIS_TOKEN;
}

async function redisCall(pathname: string, method = "POST"): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Redis not configured");
  const res = await fetch(`${REDIS_URL}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis request failed: ${res.status}`);
  const data = (await res.json().catch(() => null)) as { result?: unknown } | null;
  return data?.result ?? null;
}

export async function redisGet(key: string): Promise<string | null> {
  const result = await redisCall(`/get/${encodeURIComponent(key)}`);
  return typeof result === "string" ? result : null;
}

export async function redisSet(
  key: string,
  value: string,
  opts?: { nx?: boolean; exSeconds?: number }
): Promise<boolean> {
  let p = `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  if (opts?.nx) p += "/NX";
  if (opts?.exSeconds) p += `/EX/${opts.exSeconds}`;
  const result = await redisCall(p);
  return result === "OK";
}

export async function redisIncr(key: string): Promise<number> {
  const result = await redisCall(`/incr/${encodeURIComponent(key)}`);
  return typeof result === "number" ? result : Number(result ?? 0);
}

export async function redisDecr(key: string): Promise<number> {
  const result = await redisCall(`/decr/${encodeURIComponent(key)}`);
  return typeof result === "number" ? result : Number(result ?? 0);
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
  await redisCall(`/expire/${encodeURIComponent(key)}/${seconds}`).catch(() => {});
}

// ---------------------------------------------------------------------------
// File fallback (local dev). NOT reliable on Vercel — documented in README.
// ---------------------------------------------------------------------------

const DATA_DIR_CANDIDATES = [path.join(process.cwd(), "data"), path.join("/tmp", "redesign-ai-data")];

let resolvedDir: string | null = null;

async function getWritableDir(): Promise<string> {
  if (resolvedDir) return resolvedDir;
  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
      const probe = path.join(/* turbopackIgnore: true */ dir, ".write-test");
      await fs.writeFile(/* turbopackIgnore: true */ probe, "ok");
      await fs.unlink(/* turbopackIgnore: true */ probe).catch(() => {});
      resolvedDir = dir;
      return dir;
    } catch {
      continue;
    }
  }
  resolvedDir = DATA_DIR_CANDIDATES[0];
  return resolvedDir;
}

const memCache = new Map<string, string>();
const memLoadedFiles = new Set<string>();

async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const cacheKey = `file:${fileName}`;
  if (memLoadedFiles.has(fileName) && memCache.has(cacheKey)) {
    try {
      return JSON.parse(memCache.get(cacheKey) as string) as T;
    } catch {
      return fallback;
    }
  }
  const dir = await getWritableDir();
  const file = path.join(/* turbopackIgnore: true */ dir, fileName);
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ file, "utf-8");
    memCache.set(cacheKey, raw);
    memLoadedFiles.add(fileName);
    return JSON.parse(raw) as T;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e?.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonFile(fileName: string, value: unknown): Promise<void> {
  const dir = await getWritableDir();
  const file = path.join(/* turbopackIgnore: true */ dir, fileName);
  const raw = JSON.stringify(value, null, 2);
  memCache.set(`file:${fileName}`, raw);
  memLoadedFiles.add(fileName);
  try {
    await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(/* turbopackIgnore: true */ tmp, raw, "utf-8");
    await fs.rename(/* turbopackIgnore: true */ tmp, /* turbopackIgnore: true */ file);
  } catch (err) {
    // Ephemeral FS on serverless — keep in-memory copy, warn once.
    console.warn(`File store write failed (${fileName}), using memory only:`, err);
  }
}

// Per-key promise-chain mutex so concurrent increments on one instance are atomic.
const lockChains = new Map<string, Promise<void>>();

export function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = lockChains.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockChains.set(key, prev.then(() => current));
  return prev
    .then(fn)
    .finally(() => {
      release();
      if (lockChains.get(key) === current) lockChains.delete(key);
    });
}

export async function fileReadJson<T>(fileName: string, fallback: T): Promise<T> {
  return readJsonFile(fileName, fallback);
}

export async function fileWriteJson(fileName: string, value: unknown): Promise<void> {
  return writeJsonFile(fileName, value);
}
