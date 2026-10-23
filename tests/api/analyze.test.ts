import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { POST as analyzePOST } from "@/app/api/analyze/route";
import {
  generateGeminiContent,
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

// Mock gemini client to avoid real API calls
vi.mock("@/app/lib/gemini", () => ({
  getGeminiClient: vi.fn(() => ({
    models: { generateContent: vi.fn() },
  })),
  generateGeminiContent: vi.fn().mockResolvedValue({ text: "analysis result" }),
  readGeminiResponseText: vi.fn((response: GenerateContentResponse) =>
    response.text ?? ""
  ),
  GEMINI_MODEL: "test-model",
}));

import { getServerSession } from "next-auth";
const mockedGetServerSession = getServerSession as unknown as ReturnType<
  typeof vi.fn
>;

function formRequest(
  fields: Record<string, string | File>,
  headers: Record<string, string> = {}
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request("https://app.example/api/analyze", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      ...headers,
    },
    body: form,
  });
}

function pngFile(name = "test.png"): File {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(800, 16);
  buffer.writeUInt32BE(600, 20);
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}

beforeEach(() => {
  mockedGetServerSession.mockReset();
  vi.restoreAllMocks();
  vi.mocked(generateGeminiContent).mockResolvedValue(
    geminiResponse("analysis result")
  );
  vi.mocked(readGeminiResponseText).mockImplementation(
    (response: GenerateContentResponse) => response.text ?? ""
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/analyze", () => {
  it("returns 400 when no image is uploaded", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await analyzePOST(formRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("image");
  });

  it("returns 400 for unsupported image type", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], "a.gif", {
      type: "image/gif",
    });
    const res = await analyzePOST(formRequest({ image: gif }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty file", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const empty = new File([new Uint8Array(0)], "empty.png", {
      type: "image/png",
    });
    const res = await analyzePOST(formRequest({ image: empty }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when MIME type does not match file content", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff]);
    const mislabeled = new File([jpegBytes], "image.png", { type: "image/png" });
    const res = await analyzePOST(formRequest({ image: mislabeled }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for oversized image", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const oversized = new File(
      [new Uint8Array(11 * 1024 * 1024)],
      "big.png",
      { type: "image/png" }
    );
    const res = await analyzePOST(formRequest({ image: oversized }));
    expect(res.status).toBe(413);
  });

  it("rejects cross-origin requests", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = formRequest(
      { image: pngFile() },
      { origin: "https://evil.example" }
    );
    const res = await analyzePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 without leaking internals when Gemini fails", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    vi.mocked(generateGeminiContent).mockRejectedValueOnce(
      new Error("API key AIza-secret-leak is invalid")
    );
    const res = await analyzePOST(formRequest({ image: pngFile() }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("AIza");
    expect(body.error).not.toContain("leak");
  });

  it("returns successful analysis for valid image", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    vi.mocked(generateGeminiContent).mockResolvedValue(
      geminiResponse("Valid analysis")
    );
    vi.mocked(readGeminiResponseText).mockReturnValue("Valid analysis");
    const res = await analyzePOST(formRequest({ image: pngFile() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.analysis).toBe("Valid analysis");
  });
});