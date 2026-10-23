import { describe, expect, it } from "vitest";
import { AppError } from "@/app/lib/errors";
import {
  coerceRedesignSpec,
  parseRedesignSpecJson,
} from "@/app/lib/redesign";

const validSpec = {
  title: "A better page",
  subtitle: "Clear hierarchy",
  description: "A focused redesign.",
  primaryButton: "Get started",
  secondaryButton: "Learn more",
  theme: {
    background: "#000",
    surface: "#111",
    accent: "#22d3ee",
    text: "#fff",
  },
  layout: "Hero then features.",
  designStyle: "Modern and accessible.",
  improvements: ["Improve contrast."],
};

describe("parseRedesignSpecJson", () => {
  it("parses JSON with markdown fences", () => {
    const parsed = parseRedesignSpecJson(`\`\`\`json\n${JSON.stringify(validSpec)}\n\`\`\``);
    expect(parsed.title).toBe("A better page");
    expect(parsed.theme.background).toBe("#000000");
    expect(parsed.theme.surface).toBe("#111111");
  });

  it("rejects malformed JSON without leaking parser details", () => {
    expect(() => parseRedesignSpecJson("{not json")).toThrow(AppError);
    try {
      parseRedesignSpecJson("{not json");
    } catch (error) {
      expect((error as AppError).status).toBe(502);
      expect((error as AppError).message).not.toContain("position");
    }
  });

  it("rejects oversized AI output", () => {
    const oversized = JSON.stringify({ ...validSpec, description: "a".repeat(50_000) });
    expect(() => parseRedesignSpecJson(oversized)).toThrow(AppError);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseRedesignSpecJson("[]")).toThrow(AppError);
  });
});

describe("coerceRedesignSpec", () => {
  it("clamps string and array sizes", () => {
    const spec = coerceRedesignSpec({
      ...validSpec,
      title: "t".repeat(500),
      improvements: Array.from({ length: 20 }, () => "i".repeat(1000)),
    });

    expect(spec.title.length).toBeLessThanOrEqual(200);
    expect(spec.improvements.length).toBeLessThanOrEqual(6);
    expect(spec.improvements[0].length).toBeLessThanOrEqual(400);
  });

  it("replaces unsafe color values and empty strings with fallbacks", () => {
    const spec = coerceRedesignSpec({
      ...validSpec,
      title: "   ",
      theme: { ...validSpec.theme, accent: "url(javascript:alert(1))" },
    });

    expect(spec.title).not.toBe("   ");
    expect(spec.theme.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("strips control characters", () => {
    const spec = coerceRedesignSpec({ ...validSpec, subtitle: "Hello\u0000\u0007 world" });
    expect(spec.subtitle).toBe("Hello world");
  });
});
