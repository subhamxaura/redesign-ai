import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { enforceRateLimits, rateLimit } from "@/app/lib/rateLimit";

function key(name: string): string {
  return `${name}:${randomUUID()}`;
}

describe("rateLimit", () => {
  it("allows up to the limit and then blocks", async () => {
    const bucket = { key: key("test"), limit: 2, windowSeconds: 60 };

    expect((await rateLimit(bucket)).allowed).toBe(true);
    expect((await rateLimit(bucket)).allowed).toBe(true);

    const denied = await rateLimit(bucket);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("is atomic under concurrent requests", async () => {
    const bucket = { key: key("concurrent"), limit: 3, windowSeconds: 60 };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => rateLimit(bucket))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  it("stops evaluation when any bucket is exhausted", async () => {
    const allowedKey = key("allowed");
    const deniedKey = key("denied");

    for (let i = 0; i < 2; i += 1) {
      await rateLimit({ key: deniedKey, limit: 1, windowSeconds: 60 });
    }

    const result = await enforceRateLimits([
      { key: allowedKey, limit: 10, windowSeconds: 60 },
      { key: deniedKey, limit: 1, windowSeconds: 60 },
    ]);

    expect(result?.allowed).toBe(false);
    expect((await rateLimit({ key: allowedKey, limit: 10, windowSeconds: 60 })).remaining).toBe(8);
  });
});
