import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST as signupPOST } from "@/app/api/auth/signup/route";

// Mock next-auth so getServerSession returns a controllable session
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

let requestSequence = 0;

function nextUserAgent(): string {
  requestSequence += 1;
  return `vitest-signup-${requestSequence}`;
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://app.example/api/auth/signup", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      "content-type": "application/json",
      "user-agent": nextUserAgent(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validSignup = {
  name: "Ada Lovelace",
  email: `ada-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
};

beforeEach(() => {
  mockedGetServerSession.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/signup", () => {
  it("creates an account with valid input", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await signupPOST(jsonRequest(validSignup));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(validSignup.email);
  });

  it("rejects malformed JSON body", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = new Request("https://app.example/api/auth/signup", {
      method: "POST",
      headers: {
        origin: "https://app.example",
        host: "app.example",
        "content-type": "application/json",
        "user-agent": nextUserAgent(),
      },
      body: "{nope",
    });
    const res = await signupPOST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await signupPOST(
      jsonRequest({ name: "Ada", email: "ada@example.com" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rejects mismatched passwords", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await signupPOST(
      jsonRequest({ ...validSignup, confirmPassword: "different" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email (409)", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    // First signup creates the account
    await signupPOST(jsonRequest(validSignup));
    // Second signup with same email should conflict
    const res = await signupPOST(jsonRequest(validSignup));
    expect(res.status).toBe(409);
  });

  it("rejects cross-origin requests", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = new Request("https://app.example/api/auth/signup", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(validSignup),
    });
    const res = await signupPOST(req);
    expect(res.status).toBe(400);
  });

  it("rejects oversized JSON body", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const oversized = { name: "A", email: "a@example.com", password: "a".repeat(20000), confirmPassword: "a".repeat(20000) };
    const res = await signupPOST(jsonRequest(oversized));
    expect(res.status).toBe(413);
  });

  it("rejects unsupported name characters", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const email = `chars-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await signupPOST(
      jsonRequest({ ...validSignup, name: "Ada <script>", email })
    );
    expect(res.status).toBe(400);
  });
});