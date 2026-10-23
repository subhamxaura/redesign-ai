import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { GenerateContentResponse } from "@google/genai";
import { POST as generatePOST } from "@/app/api/generate/route";
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
  GEMINI_STRUCTURED_MODEL: "test-model",
}));

import { getServerSession } from "next-auth";
const mockedGetServerSession = getServerSession as unknown as ReturnType<
  typeof vi.fn
>;

let requestSequence = 0;

function formRequest(
  fields: Record<string, string | File>,
  headers: Record<string, string> = {}
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  requestSequence += 1;
  return new Request("https://app.example/api/generate", {
    method: "POST",
    headers: {
      origin: "https://app.example",
      host: "app.example",
      "user-agent": `vitest-generate-${requestSequence}`,
      ...headers,
    },
    body: form,
  });
}

function anonCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0] ?? "";
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
  vi.mocked(getGeminiClient).mockReturnValue({
    models: { generateContent: vi.fn() },
  } as unknown as ReturnType<typeof getGeminiClient>);
  vi.mocked(generateGeminiContent).mockResolvedValue(
    geminiResponse(
      JSON.stringify({
        title: "Test redesign",
        subtitle: "A test",
        description: "A test redesign spec.",
        primaryButton: "Start",
        secondaryButton: "Learn",
        theme: { background: "#000000", surface: "#111111", accent: "#22d3ee", text: "#ffffff" },
        layout: "Hero then features.",
        designStyle: "Modern.",
        improvements: ["Improve contrast."],
      })
    )
  );
  vi.mocked(readGeminiResponseText).mockImplementation(
    (response: GenerateContentResponse) => response.text ?? ""
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/generate", () => {
  it("returns 400 when no image is uploaded", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await generatePOST(formRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported image type", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], "a.gif", {
      type: "image/gif",
    });
    const res = await generatePOST(formRequest({ image: gif }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for oversized image", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const oversized = new File(
      [new Uint8Array(11 * 1024 * 1024)],
      "big.png",
      { type: "image/png" }
    );
    const res = await generatePOST(formRequest({ image: oversized }));
    expect(res.status).toBe(413);
  });

  it("returns 400 when no analysis text is provided", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const res = await generatePOST(formRequest({ image: pngFile() }));
    expect(res.status).toBe(400);
  });

  it("rejects cross-origin requests", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const req = formRequest(
      { image: pngFile(), analysis: "some analysis" },
      { origin: "https://evil.example" }
    );
    const res = await generatePOST(req);
    expect(res.status).toBe(400);
  });

  it("enforces the 3-free-use limit for anonymous users", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    let cookie = "";

    for (let i = 0; i < 3; i += 1) {
      const res = await generatePOST(
        formRequest(
          { image: pngFile(), analysis: "analysis " + i },
          cookie ? { cookie } : {}
        )
      );
      expect(res.status).toBe(200);
      if (!cookie) cookie = anonCookieFrom(res);
    }

    const res = await generatePOST(
      formRequest({ image: pngFile(), analysis: "analysis 4" }, { cookie })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FREE_LIMIT_REACHED");
  });

  it("refunds the quota when Gemini fails", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    vi.mocked(generateGeminiContent).mockRejectedValueOnce(new Error("Gemini down"));
    const res = await generatePOST(
      formRequest({ image: pngFile(), analysis: "analysis" })
    );
    expect(res.status).toBe(500);
    const cookie = anonCookieFrom(res);

    vi.mocked(generateGeminiContent).mockResolvedValue(
      geminiResponse(
        JSON.stringify({
          title: "Test", subtitle: "A", description: "D",
          primaryButton: "S", secondaryButton: "L",
          theme: { background: "#000000", surface: "#111111", accent: "#22d3ee", text: "#ffffff" },
          layout: "H", designStyle: "M", improvements: ["I"],
        })
      )
    );
    const res2 = await generatePOST(
      formRequest({ image: pngFile(), analysis: "analysis 2" }, { cookie })
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.usage).toBe(1);
  });

  it("returns 500 without leaking internals when Gemini fails", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    vi.mocked(generateGeminiContent).mockRejectedValueOnce(
      new Error("API key AIza-secret-leak failed")
    );
    const res = await generatePOST(
      formRequest({ image: pngFile(), analysis: "analysis" })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("AIza");
    expect(body.error).not.toContain("leak");
  });
});