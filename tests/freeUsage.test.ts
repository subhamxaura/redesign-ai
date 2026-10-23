import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  FREE_LIMIT,
  NETWORK_FREE_LIMIT,
  buildAnonCookieValue,
  getAnonIdFromCookieHeader,
  getFreeUsage,
  isValidAnonId,
  networkKeyForIp,
  newAnonId,
  parseAnonCookieValue,
  refundFreeUse,
  reserveFreeUse,
} from "@/app/lib/freeUsage";

function uniqueAnon(): string {
  return newAnonId();
}

function uniqueNetwork(): string {
  const key = networkKeyForIp(
    `198.51.100.${Math.floor(Math.random() * 250) + 1}:${randomUUID()}`
  );
  if (!key) throw new Error("Could not derive test network key.");
  return key;
}

describe("anonymous cookie signing", () => {
  it("round-trips a signed cookie and rejects tampering", () => {
    const anonId = uniqueAnon();
    const cookie = buildAnonCookieValue(anonId);

    expect(parseAnonCookieValue(cookie)).toBe(anonId);
    expect(parseAnonCookieValue(`${anonId}.${"a".repeat(43)}`)).toBeNull();
    expect(parseAnonCookieValue(`${anonId}.short`)).toBeNull();
    expect(parseAnonCookieValue("unsigned-id")).toBeNull();
    expect(isValidAnonId(anonId)).toBe(true);
    expect(isValidAnonId("bad id!")).toBe(false);
  });

  it("parses multiple cookies and ignores malformed encoding", () => {
    const anonId = uniqueAnon();
    const header = `theme=dark; rdai_anon=${encodeURIComponent(buildAnonCookieValue(anonId))}; other=1`;
    expect(getAnonIdFromCookieHeader(header)).toBe(anonId);
    expect(getAnonIdFromCookieHeader("rdai_anon=%E0%A4%A")).toBeNull();
    expect(getAnonIdFromCookieHeader(null)).toBeNull();
  });

  it("derives stable, non-reversible network keys", () => {
    const key = networkKeyForIp("203.0.113.20");
    expect(key).toHaveLength(40);
    expect(networkKeyForIp("203.0.113.20")).toBe(key);
    expect(networkKeyForIp("203.0.113.21")).not.toBe(key);
    expect(key).not.toContain("203.0.113.20");
    expect(networkKeyForIp(null)).toBeNull();
  });
});

describe("free-use reservations", () => {
  it("enforces the per-browser limit", async () => {
    const anonId = uniqueAnon();

    for (let i = 1; i <= FREE_LIMIT; i += 1) {
      const result = await reserveFreeUse(anonId);
      expect(result.allowed).toBe(true);
      expect(result.usage).toBe(i);
    }

    const denied = await reserveFreeUse(anonId);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect((await getFreeUsage(anonId)).usage).toBe(FREE_LIMIT);
  });

  it("cannot exceed the limit under concurrent requests", async () => {
    const anonId = uniqueAnon();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveFreeUse(anonId))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(FREE_LIMIT);
    expect((await getFreeUsage(anonId)).usage).toBe(FREE_LIMIT);
  });

  it("refunds failed reservations", async () => {
    const anonId = uniqueAnon();
    const network = uniqueNetwork();

    await reserveFreeUse(anonId, network);
    await reserveFreeUse(anonId, network);
    await refundFreeUse(anonId, network);

    const usage = await getFreeUsage(anonId);
    expect(usage.usage).toBe(1);
    expect(usage.remaining).toBe(FREE_LIMIT - 1);
  });

  it("enforces the larger network bucket across new cookie identities", async () => {
    const network = uniqueNetwork();
    let allowed = 0;

    for (let i = 0; i < NETWORK_FREE_LIMIT; i += 1) {
      const anonId = uniqueAnon();
      const result = await reserveFreeUse(anonId, network);
      if (result.allowed) allowed += 1;
    }

    expect(allowed).toBe(NETWORK_FREE_LIMIT);

    const denied = await reserveFreeUse(uniqueAnon(), network);
    expect(denied.allowed).toBe(false);
  });

  it("expires the file-backed network bucket after its window", async () => {
    const network = uniqueNetwork();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));

    try {
      for (let i = 0; i < NETWORK_FREE_LIMIT; i += 1) {
        await reserveFreeUse(uniqueAnon(), network);
      }
      expect((await reserveFreeUse(uniqueAnon(), network)).allowed).toBe(false);

      vi.setSystemTime(new Date("2030-02-15T00:00:00Z"));
      expect((await reserveFreeUse(uniqueAnon(), network)).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
