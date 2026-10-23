// Server-only persistent key-value layer.
// Prefers Upstash Redis (REST) when configured - required for correct
// behavior on Vercel serverless (many instances, ephemeral filesystem).
// Falls back to a local JSON file + in-memory cache for local development.
//
// Production requirement:
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// OR an explicitly configured persistent volume:
//   DURABLE_FILE_STORAGE=true + REDESIGN_DATA_DIR=/mounted/persistent/path
//
// In production, operations fail closed (503) when neither is configured or
// when a configured storage backend errors. Ephemeral /tmp storage is never
// treated as durable.

import { promises as fs } from "fs";
import path from "path";
import { ConfigurationError, StorageUnavailableError, logServerError } from "@/app/lib/errors";

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

const REDIS_TIMEOUT_MS = 3_000;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isRedisConfigured(): boolean {
  return getRedisConfig() !== null;
}

export function isDurableFileStorageConfigured(): boolean {
  return process.env.DURABLE_FILE_STORAGE === "true" && !!process.env.REDESIGN_DATA_DIR?.trim();
}

export function isDurableStorageConfigured(): boolean {
  return isRedisConfigured() || isDurableFileStorageConfigured();
}

export function assertDurableStorage(): void {
  if (isProduction() && !isDurableStorageConfigured()) {
    logServerError(
      "storage",
      new ConfigurationError(
        "Durable storage is not configured. Set Redis or DURABLE_FILE_STORAGE + REDESIGN_DATA_DIR."
      )
    );
    throw new ConfigurationError();
  }
}

export function handleStorageFailure(context: string, error: unknown): void {
  logServerError(context, error);
  if (isProduction()) {
    throw new StorageUnavailableError(error);
  }
}

// ---------------------------------------------------------------------------
// Upstash Redis REST client (POST command array format)
// ---------------------------------------------------------------------------

export async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const config = getRedisConfig();
  if (!config) throw new Error("Redis not configured");

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Redis request failed: ${res.status}`);

  const data = (await res.json().catch(() => null)) as { result?: unknown; error?: unknown } | null;
  if (data?.error) throw new Error(`Redis command failed: ${String(data.error)}`);
  return data?.result ?? null;
}

export async function redisGet(key: string): Promise<string | null> {
  const result = await redisCommand(["GET", key]);
  return typeof result === "string" ? result : null;
}

export async function redisSet(
  key: string,
  value: string,
  opts?: { nx?: boolean; exSeconds?: number }
): Promise<boolean> {
  const cmd: (string | number)[] = ["SET", key, value];
  if (opts?.exSeconds) {
    cmd.push("EX", opts.exSeconds);
  }
  if (opts?.nx) {
    cmd.push("NX");
  }
  const result = await redisCommand(cmd);
  return result === "OK";
}

export async function redisIncr(key: string): Promise<number> {
  const result = await redisCommand(["INCR", key]);
  return typeof result === "number" ? result : Number(result ?? 0);
}

export async function redisDecr(key: string): Promise<number> {
  const result = await redisCommand(["DECR", key]);
  return typeof result === "number" ? result : Number(result ?? 0);
}

export async function redisExpire(key: string, seconds: number): Promise<void> {
  await redisCommand(["EXPIRE", key, seconds]);
}

export async function redisTtl(key: string): Promise<number> {
  const result = await redisCommand(["TTL", key]);
  const ttl = typeof result === "number" ? result : Number(result);
  return Number.isFinite(ttl) ? ttl : -1;
}

// ---------------------------------------------------------------------------
// File fallback (local dev, or an explicitly durable persistent volume)
// ---------------------------------------------------------------------------

function dataDirCandidates(): string[] {
  const configured = process.env.REDESIGN_DATA_DIR?.trim();

  if (isProduction()) {
    // Never silently fall back to an ephemeral app directory in production.
    return configured
      ? [path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)]
      : [];
  }

  const candidates = [
    configured ? path.resolve(process.cwd(), configured) : null,
    path.join(process.cwd(), "data"),
    path.join("/tmp", "redesign-ai-data"),
  ];
  return candidates.filter((value): value is string => !!value);
}

const DATA_DIR_CANDIDATES = dataDirCandidates();
let resolvedDir: string | null = null;

async function getWritableDir(): Promise<string> {
  if (resolvedDir) return resolvedDir;

  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true, mode: 0o700 });
      const probe = path.join(/* turbopackIgnore: true */ dir, ".write-test");
      await fs.writeFile(/* turbopackIgnore: true */ probe, "ok", { mode: 0o600 });
      await fs.unlink(/* turbopackIgnore: true */ probe).catch(() => {});
      resolvedDir = dir;
      return dir;
    } catch {
      continue;
    }
  }

  if (isProduction()) {
    throw new StorageUnavailableError(new Error("No writable durable data directory."));
  }

  resolvedDir = DATA_DIR_CANDIDATES[0] ?? path.join(process.cwd(), "data");
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
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return fallback;
    if (isProduction()) throw new StorageUnavailableError(error);
    throw error;
  }
}

async function writeJsonFile(fileName: string, value: unknown): Promise<void> {
  const dir = await getWritableDir();
  const file = path.join(/* turbopackIgnore: true */ dir, fileName);
  const raw = JSON.stringify(value, null, 2);

  try {
    await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp`;
    await fs.writeFile(/* turbopackIgnore: true */ tmp, raw, { encoding: "utf-8", mode: 0o600 });
    await fs.rename(/* turbopackIgnore: true */ tmp, /* turbopackIgnore: true */ file);
    memCache.set(`file:${fileName}`, raw);
    memLoadedFiles.add(fileName);
  } catch (error) {
    if (isProduction()) throw new StorageUnavailableError(error);
    memCache.set(`file:${fileName}`, raw);
    memLoadedFiles.add(fileName);
    console.warn(`File store write failed (${fileName}), using memory only:`, error);
  }
}

// Per-key promise-chain mutex so concurrent mutations on one instance are serialized.
const lockChains = new Map<string, Promise<void>>();

export function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = lockChains.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  lockChains.set(key, tail);

  return run.finally(() => {
    if (lockChains.get(key) === tail) lockChains.delete(key);
  });
}

export async function fileReadJson<T>(fileName: string, fallback: T): Promise<T> {
  return readJsonFile(fileName, fallback);
}

export async function fileWriteJson(fileName: string, value: unknown): Promise<void> {
  return writeJsonFile(fileName, value);
}
