import { afterEach, describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  getClientIp,
  getRateLimitIdentity,
  MAX_JSON_BYTES,
  readFormDataWithLimit,
  readJsonBody,
} from "@/app/lib/http";
import { InvalidRequestError, PayloadTooLargeError } from "@/app/lib/errors";

function jsonRequest(body: BodyInit, headers?: HeadersInit): Request {
  return new Request("https://app.example/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("readJsonBody", () => {
  it("parses valid JSON", async () => {
    await expect(readJsonBody(jsonRequest('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it("rejects malformed JSON", async () => {
    await expect(readJsonBody(jsonRequest("{nope"))).rejects.toBeInstanceOf(
      InvalidRequestError
    );
  });

  it("rejects invalid UTF-8 instead of leaking a decoder error", async () => {
    await expect(
      readJsonBody(jsonRequest(new Uint8Array([0xff, 0xfe, 0xfd])))
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it("enforces the byte limit", async () => {
    const body = JSON.stringify({ data: "a".repeat(MAX_JSON_BYTES) });
    await expect(readJsonBody(jsonRequest(body))).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });
});

describe("assertSameOrigin", () => {
  it("allows same-origin and header-less requests", () => {
    const sameOrigin = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { origin: "https://app.example", host: "app.example" },
    });
    const serverToServer = new Request("https://app.example/api/test", {
      method: "POST",
    });

    expect(() => assertSameOrigin(sameOrigin)).not.toThrow();
    expect(() => assertSameOrigin(serverToServer)).not.toThrow();
  });

  it("rejects cross-origin browser requests", () => {
    const crossOrigin = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "app.example" },
    });
    const fetchMetadataOnly = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });

    expect(() => assertSameOrigin(crossOrigin)).toThrow(InvalidRequestError);
    expect(() => assertSameOrigin(fetchMetadataOnly)).toThrow(InvalidRequestError);
  });
});

describe("readFormDataWithLimit", () => {
  it("parses multipart data and enforces the limit", async () => {
    const form = new FormData();
    form.set("field", "value");
    const request = new Request("https://app.example/api/test", {
      method: "POST",
      body: form,
    });

    const parsed = await readFormDataWithLimit(request);
    expect(parsed.get("field")).toBe("value");

    const oversized = new Request("https://app.example/api/test", {
      method: "POST",
      body: form,
    });
    await expect(readFormDataWithLimit(oversized, 10)).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });
});

describe("getClientIp", () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.VERCEL;
  });

  it("trusts the Vercel-controlled header only on Vercel", () => {
    const request = new Request("https://app.example", {
      headers: { "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBeNull();

    process.env.VERCEL = "1";
    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("ignores spoofable proxy headers by default", () => {
    const request = new Request("https://app.example", {
      headers: { "x-forwarded-for": "198.51.100.4", "x-real-ip": "198.51.100.5" },
    });
    expect(getClientIp(request)).toBeNull();
  });

  it("trusts proxy headers only when explicitly enabled", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const request = new Request("https://app.example", {
      headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("198.51.100.4");
  });

  it("rejects invalid IP values", () => {
    process.env.VERCEL = "1";
    const request = new Request("https://app.example", {
      headers: { "x-vercel-forwarded-for": "not-an-ip" },
    });
    expect(getClientIp(request)).toBeNull();
  });

  it("uses request hints rather than one global bucket when no IP is available", () => {
    const first = new Request("https://app.example", {
      headers: { "user-agent": "agent-a", "accept-language": "en" },
    });
    const second = new Request("https://app.example", {
      headers: { "user-agent": "agent-b", "accept-language": "en" },
    });

    expect(getRateLimitIdentity(first)).not.toBe(getRateLimitIdentity(second));
    expect(getRateLimitIdentity(first)).not.toContain("203.0.113");
  });
});
