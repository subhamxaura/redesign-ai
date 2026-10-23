import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { POST as chatPOST } from "@/app/api/chat/route";
import {
  generateGeminiContent,
  getGeminiClient,
  readGeminiResponseText,
} from "@/app/lib/gemini";

function geminiResponse(text: string): GenerateContentResponse {
  return { text } as unknown as GenerateContentResponse;
}

// Mock next-auth session
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return { ...actual, getServerSession: vi.fn() };
});

// Mock gemini to avoid real API calls
vi.mock("@/app/lib/gemini", () => ({
  generateGeminiContent: vi.fn(),
  getGeminiClient: vi.fn(),
  asUntrustedPromptBlock: (_label: string, text: string) => text,
  readGeminiResponseText: vi.fn((response: GenerateContentResponse) => response.text ?? ""),
  GEMINI_MODEL: "test-model",
}));

import { getServerSession } from "next-auth";
const mockedGetServerSession = getServerSession as unknown as ReturnType<
  typeof vi.fn
>;

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://app.example/api/chat", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedGetServerSession.mockReset();
  vi.mocked(getGeminiClient).mockReturnValue({
    models: { generateContent: vi.fn() },
  } as unknown as ReturnType<typeof getGeminiClient>);
  vi.mocked(generateGeminiContent).mockResolvedValue(
    geminiResponse("Hello! How can I help?")
  );
  vi.mocked(readGeminiResponseText).mockImplementation(
    (response: GenerateContentResponse) => response.text ?? ""
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("returns a reply for a valid message", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chatPOST(jsonRequest({ message: "hello" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Hello! How can I help?");
  });

  it("returns 400 for missing message", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chatPOST(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty/whitespace message", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chatPOST(jsonRequest({ message: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for oversized message", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chatPOST(jsonRequest({ message: "a".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = new Request("https://app.example/api/chat", {
      method: "POST",
      headers: {
        origin: "https://app.example",
        host: "app.example",
        "content-type": "application/json",
      },
      body: "{nope",
    });
    const res = await chatPOST(req);
    expect(res.status).toBe(400);
  });

  it("rejects cross-origin requests", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = new Request("https://app.example/api/chat", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "app.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "hello" }),
    });
    const res = await chatPOST(req);
    expect(res.status).toBe(400);
  });

  it("rejects extra fields (strict schema)", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await chatPOST(jsonRequest({ message: "hi", admin: true }));
    expect(res.status).toBe(400);
  });

  it("returns 500 without leaking internals when Gemini fails", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    vi.mocked(generateGeminiContent).mockRejectedValueOnce(
      new Error("API key AIza-secret-leak failed")
    );
    const res = await chatPOST(jsonRequest({ message: "hello" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("AIza");
    expect(body.error).not.toContain("leak");
  });
});