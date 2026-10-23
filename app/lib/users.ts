import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  assertDurableStorage,
  fileReadJson,
  fileWriteJson,
  handleStorageFailure,
  isProduction,
  isRedisConfigured,
  redisGet,
  redisSet,
  withFileLock,
} from "@/app/lib/store";
import { logServerError } from "@/app/lib/errors";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export class DuplicateAccountError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "DuplicateAccountError";
  }
}

const USERS_FILE = "users.json";
const USER_LOCK = "users";
const BCRYPT_ROUNDS = 12;

function userKey(normalizedEmail: string): string {
  return `rdai:user:${normalizedEmail.toLowerCase().trim()}`;
}

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.passwordHash === "string" &&
    typeof user.createdAt === "string"
  );
}

function parseStoredUser(raw: string | null): StoredUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readUsers(): Promise<StoredUser[]> {
  const parsed = await fileReadJson<unknown>(USERS_FILE, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isStoredUser);
}

export async function getAllUsers(): Promise<StoredUser[]> {
  assertDurableStorage();
  return readUsers();
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  assertDurableStorage();

  const normalized = email.toLowerCase().trim();

  if (isRedisConfigured()) {
    try {
      const raw = await redisGet(userKey(normalized));
      if (raw !== null) {
        const parsed = parseStoredUser(raw);
        if (!parsed) {
          handleStorageFailure("user lookup", new Error("Stored user record is invalid."));
          return null;
        }
        return parsed;
      }

      // In development, allow records created while Redis was unavailable to
      // remain usable. Production treats Redis as authoritative.
      if (isProduction()) return null;
    } catch (error) {
      handleStorageFailure("user lookup", error);
    }
  }

  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  assertDurableStorage();

  if (isRedisConfigured()) {
    try {
      const email = await redisGet(`rdai:userid:${id}`);
      if (email) {
        const raw = await redisGet(userKey(email));
        const parsed = parseStoredUser(raw);
        return parsed && parsed.id === id ? parsed : null;
      }

      if (isProduction()) return null;
    } catch (error) {
      handleStorageFailure("user-id lookup", error);
    }
  }

  const users = await readUsers();
  return users.find((user) => user.id === id) ?? null;
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
}): Promise<StoredUser> {
  assertDurableStorage();

  const normalizedEmail = params.email.toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) throw new DuplicateAccountError();

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const user: StoredUser = {
    id: `user_${randomUUID()}`,
    name: params.name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  if (isRedisConfigured()) {
    let created: boolean | null = null;
    try {
      created = await redisSet(userKey(normalizedEmail), JSON.stringify(user), { nx: true });
    } catch (error) {
      // Throws in production; logs and falls back to the file store in dev.
      handleStorageFailure("user create", error);
    }

    if (created === false) {
      // Another instance won the race (NX rejected the write).
      throw new DuplicateAccountError();
    }

    if (created === true) {
      // Secondary id -> email index. Best effort: the primary login record is
      // already durable and login/dashboard operate by email.
      try {
        await redisSet(`rdai:userid:${user.id}`, normalizedEmail);
      } catch (error) {
        logServerError("user id index", error);
      }

      return user;
    }
  }

  return withFileLock(USER_LOCK, async () => {
    const users = await readUsers();
    if (users.some((candidate) => candidate.email.toLowerCase() === normalizedEmail)) {
      throw new DuplicateAccountError();
    }
    users.push(user);
    await fileWriteJson(USERS_FILE, users);
    return user;
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
