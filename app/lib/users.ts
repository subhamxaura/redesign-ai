import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  isRedisConfigured,
  redisGet,
  redisSet,
} from "@/app/lib/store";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), "data"),
  path.join("/tmp", "redesign-ai-data"),
];

let resolvedDataDir: string | null = null;
let resolvedFilePath: string | null = null;

async function getDataPaths() {
  if (resolvedDataDir && resolvedFilePath) {
    return { dir: resolvedDataDir, file: resolvedFilePath };
  }
  for (const dir of DATA_DIR_CANDIDATES) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const testFile = path.join(dir, ".write-test");
      await fs.writeFile(testFile, "ok");
      await fs.unlink(testFile).catch(() => {});
      resolvedDataDir = dir;
      resolvedFilePath = path.join(dir, "users.json");
      return { dir, file: resolvedFilePath };
    } catch {
      continue;
    }
  }
  // fallback to first candidate (will error later but keep path)
  resolvedDataDir = DATA_DIR_CANDIDATES[0];
  resolvedFilePath = path.join(resolvedDataDir, "users.json");
  return { dir: resolvedDataDir, file: resolvedFilePath };
}

// In-memory cache to handle ephemeral FS and avoid repeated reads
let memoryUsers: StoredUser[] | null = null;
let memoryLoaded = false;

async function readUsersFromDisk(): Promise<StoredUser[]> {
  const { file } = await getDataPaths();
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ file, "utf-8");
    const parsed = JSON.parse(raw) as StoredUser[];
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
}

async function writeUsersToDisk(users: StoredUser[]): Promise<void> {
  const { dir, file } = await getDataPaths();
  await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(/* turbopackIgnore: true */ tmp, JSON.stringify(users, null, 2), "utf-8");
  await fs.rename(/* turbopackIgnore: true */ tmp, /* turbopackIgnore: true */ file);
}

export async function getAllUsers(): Promise<StoredUser[]> {
  if (memoryLoaded && memoryUsers) return memoryUsers;
  const disk = await readUsersFromDisk();
  // Merge memory and disk (memory may have newer users in case FS is ephemeral)
  if (memoryUsers && memoryUsers.length > 0) {
    const byId = new Map<string, StoredUser>();
    for (const u of disk) byId.set(u.id, u);
    for (const u of memoryUsers) byId.set(u.id, u);
    const merged = Array.from(byId.values());
    memoryUsers = merged;
    memoryLoaded = true;
    // try to persist merged
    await writeUsersToDisk(merged).catch(() => {});
    return merged;
  }
  memoryUsers = disk;
  memoryLoaded = true;
  return disk;
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.toLowerCase().trim();
  // Prefer Redis when configured so logins survive Vercel serverless instances.
  if (isRedisConfigured()) {
    try {
      const raw = await redisGet(userKey(normalized));
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUser;
        if (parsed && parsed.email) return parsed;
      }
      return null;
    } catch (err) {
      console.error("Redis user lookup failed, falling back to file:", err);
    }
  }
  const users = await getAllUsers();
  return users.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  if (isRedisConfigured()) {
    try {
      const email = await redisGet(`rdai:userid:${id}`);
      if (email) {
        const raw = await redisGet(userKey(email));
        if (raw) {
          const parsed = JSON.parse(raw) as StoredUser;
          if (parsed && parsed.id === id) return parsed;
        }
      }
    } catch (err) {
      console.error("Redis user-id lookup failed, falling back to file:", err);
    }
  }
  const users = await getAllUsers();
  return users.find((u) => u.id === id) ?? null;
}

function userKey(normalizedEmail: string): string {
  return `rdai:user:${normalizedEmail.toLowerCase().trim()}`;
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
}): Promise<StoredUser> {
  const normalizedEmail = params.email.toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error("An account with this email already exists.");
  }
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(params.password, 12);
  const user: StoredUser = {
    id,
    name: params.name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  const users = await getAllUsers();
  users.push(user);
  memoryUsers = users;
  // Mirror to Redis atomically-ish (NX prevents duplicate-email races on
  // multi-instance Vercel). File write is best-effort local persistence.
  if (isRedisConfigured()) {
    try {
      const created = await redisSet(userKey(normalizedEmail), JSON.stringify(user), {
        nx: true,
      });
      if (!created) {
        // Another instance won the race — keep stores consistent.
        memoryUsers = memoryUsers.filter((u) => u.id !== user.id);
        throw new Error("An account with this email already exists.");
      }
      // Secondary id -> email index (best-effort, no NX needed).
      await redisSet(`rdai:userid:${user.id}`, normalizedEmail).catch(() => false);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("already exists")) throw err;
      console.error("Redis user persist failed, using file fallback:", err);
    }
  }
  try {
    await writeUsersToDisk(users);
  } catch (err) {
    console.warn("Failed to persist user to disk (ephemeral FS):", err);
  }
  return user;
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Rate limiting helper (in-memory, per instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: max - entry.count };
}

export function validateSignupInput(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
}): { valid: boolean; error?: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const confirm = typeof input.confirmPassword === "string" ? input.confirmPassword : "";

  if (!name || name.length < 2) return { valid: false, error: "Name must be at least 2 characters." };
  if (name.length > 60) return { valid: false, error: "Name must be 60 characters or fewer." };
  if (!email) return { valid: false, error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: "Please enter a valid email address." };
  if (email.length > 254) return { valid: false, error: "Email is too long." };
  if (!password) return { valid: false, error: "Password is required." };
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters." };
  if (password.length > 128) return { valid: false, error: "Password must be 128 characters or fewer." };
  // Strength: at least one letter + one number, or allow any but encourage
  // Keep requirements clear but not overly strict for UX
  if (confirm !== password) return { valid: false, error: "Passwords do not match." };
  return { valid: true };
}
