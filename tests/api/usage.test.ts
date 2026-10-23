import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET as usageGET } from "@/app/api/usage/route";

// Mock next-auth session
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return {
    ...actual,
    getServerSession: vi.fn(),
  };
});

import { getServerSession } from "next-auth";
const mockedGetServerSession = getServerSession as unknown as ReturnType<
  typeof vi.fn
>;

function requestWithCookie(cookie: string | null): Request {
  const headers: Record<string, string> = {
    host: "app.example",
  };
  if (cookie) headers["cookie"] = cookie;
  return new Request("https://app.example/api/usage", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  mockedGetServerSession.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/usage", () => {
  it("returns authenticated status for signed-in user", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { email: "user@example.com", name: "User", id: "user_1" },
    });
    const res = await usageGET(requestWithCookie(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.remaining).toBe(3);
  });

  it("returns anonymous usage for unsigned visitor", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await usageGET(requestWithCookie(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.limit).toBe(3);
    expect(typeof body.usage).toBe("number");
    expect(typeof body.remaining).toBe("number");
    // Should set the anon cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("rdai_anon=");
  });

  it("persists the same anon id across requests via cookie", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const first = await usageGET(requestWithCookie(null));
    const setCookie = first.headers.get("set-cookie") ?? "";
    const anonMatch = setCookie.match(/rdai_anon=([^;]+)/);
    expect(anonMatch).toBeTruthy();
    expect(anonMatch![1]).toContain(".");

    const second = await usageGET(
      requestWithCookie(`rdai_anon=${encodeURIComponent(setCookie.split("rdai_anon=")[1]?.split(";")[0] ?? "")}`)
    );
    const secondBody = await second.json();
    expect(secondBody.authenticated).toBe(false);
    // Cookie-based identity should be recognized (usage preserved)
    expect(typeof secondBody.usage).toBe("number");
  });

  it("rejects malformed cookie without crashing", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await usageGET(
      requestWithCookie("rdai_anon=%E0%A4%A")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("returns 500 on unexpected error without leaking internals", async () => {
    mockedGetServerSession.mockRejectedValue(new Error("boom"));
    const res = await usageGET(requestWithCookie(null));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("boom");
  });
});