import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDurableStorage,
  redisCommand,
  redisDecr,
  redisExpire,
  redisGet,
  redisIncr,
  redisSet,
  redisTtl,
} from "@/app/lib/store";
import { ConfigurationError } from "@/app/lib/errors";

const originalNodeEnv = process.env.NODE_ENV;
const originalDurable = process.env.DURABLE_FILE_STORAGE;
const originalDataDir = process.env.REDESIGN_DATA_DIR;
const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(originalNodeEnv);
  if (originalDurable === undefined) delete process.env.DURABLE_FILE_STORAGE;
  else process.env.DURABLE_FILE_STORAGE = originalDurable;
  if (originalDataDir === undefined) delete process.env.REDESIGN_DATA_DIR;
  else process.env.REDESIGN_DATA_DIR = originalDataDir;
  if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
  if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
  vi.restoreAllMocks();
});

describe("production storage guard", () => {
  it("fails closed when no durable storage is configured", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setNodeEnv("production");
    delete process.env.DURABLE_FILE_STORAGE;
    delete process.env.REDESIGN_DATA_DIR;

    expect(() => assertDurableStorage()).toThrow(ConfigurationError);
  });

  it("accepts an explicitly configured persistent directory", () => {
    setNodeEnv("production");
    process.env.DURABLE_FILE_STORAGE = "true";
    process.env.REDESIGN_DATA_DIR = "./persistent-data";

    expect(() => assertDurableStorage()).not.toThrow();
  });

  it("does not require durable storage outside production", () => {
    setNodeEnv("test");
    delete process.env.DURABLE_FILE_STORAGE;
    delete process.env.REDESIGN_DATA_DIR;

    expect(() => assertDurableStorage()).not.toThrow();
  });
});

describe("Redis POST command serialization", () => {
  const fakeUrl = "https://mock-redis.upstash.io";
  const fakeToken = "mock_token_123";

  it("sends redisSet commands in POST body as JSON, not in URL path", async () => {
    process.env.UPSTASH_REDIS_REST_URL = fakeUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = fakeToken;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: "OK" }), { status: 200 })
    );

    const largeJsonValue = JSON.stringify({
      id: "user_12345",
      name: "Test User",
      email: "test@example.com",
      payload: "x".repeat(5000), // 5KB payload that would break URL path limits
    });

    const success = await redisSet("user:test@example.com", largeJsonValue, {
      exSeconds: 3600,
      nx: true,
    });

    expect(success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    // Verified: URL is the base endpoint, NOT containing the key or payload in the path
    expect(calledUrl).toBe(fakeUrl);
    expect(calledInit?.method).toBe("POST");
    expect((calledInit?.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${fakeToken}`
    );
    expect((calledInit?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );

    // Verified: the command array is serialized in the request body
    const sentBody = JSON.parse(calledInit?.body as string);
    expect(sentBody).toEqual([
      "SET",
      "user:test@example.com",
      largeJsonValue,
      "EX",
      3600,
      "NX",
    ]);
  });

  it("formats redisGet, redisIncr, redisDecr, redisExpire, redisTtl using POST body", async () => {
    process.env.UPSTASH_REDIS_REST_URL = fakeUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = fakeToken;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      const cmd = body[0];
      if (cmd === "GET") return new Response(JSON.stringify({ result: "stored_val" }));
      if (cmd === "INCR") return new Response(JSON.stringify({ result: 2 }));
      if (cmd === "DECR") return new Response(JSON.stringify({ result: 1 }));
      if (cmd === "EXPIRE") return new Response(JSON.stringify({ result: 1 }));
      if (cmd === "TTL") return new Response(JSON.stringify({ result: 60 }));
      return new Response(JSON.stringify({ result: null }));
    });

    const getVal = await redisGet("test:key");
    expect(getVal).toBe("stored_val");

    const incrVal = await redisIncr("test:counter");
    expect(incrVal).toBe(2);

    const decrVal = await redisDecr("test:counter");
    expect(decrVal).toBe(1);

    await redisExpire("test:key", 60);

    const ttlVal = await redisTtl("test:key");
    expect(ttlVal).toBe(60);

    expect(fetchSpy).toHaveBeenCalledTimes(5);
    // Every call sent POST to fakeUrl with JSON body
    for (const call of fetchSpy.mock.calls) {
      expect(call[0]).toBe(fakeUrl);
      expect(call[1]?.method).toBe("POST");
    }
  });

  it("handles Redis command errors cleanly", async () => {
    process.env.UPSTASH_REDIS_REST_URL = fakeUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = fakeToken;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "ERR unknown command" }), { status: 200 })
    );

    await expect(redisCommand(["INVALID", "key"])).rejects.toThrow(
      "Redis command failed: ERR unknown command"
    );
  });
});
