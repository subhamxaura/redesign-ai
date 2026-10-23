import { describe, expect, it } from "vitest";
import {
  MAX_ANALYSIS_INPUT_CHARS,
  chatRequestSchema,
  parseAnalysisInput,
  signupSchema,
} from "@/app/lib/validation";

describe("signupSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ADA@Example.com",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
  };

  it("normalizes email and accepts valid input", () => {
    const result = signupSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("rejects passwords over bcrypt's 72-byte limit", () => {
    const password = "é".repeat(40);
    const result = signupSchema.safeParse({
      ...valid,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields and unsafe names", () => {
    expect(signupSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, name: "<script>" }).success).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("trims and accepts a normal message", () => {
    const result = chatRequestSchema.safeParse({ message: "  hello  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe("hello");
  });

  it("rejects empty, oversized, and extra fields", () => {
    expect(chatRequestSchema.safeParse({ message: " " }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "a".repeat(2001) }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "hi", admin: true }).success).toBe(false);
  });
});

describe("parseAnalysisInput", () => {
  it("bounds analysis input", () => {
    expect(parseAnalysisInput(" analyze ")).toBe("analyze");
    expect(parseAnalysisInput("")).toBeNull();
    expect(parseAnalysisInput("a".repeat(MAX_ANALYSIS_INPUT_CHARS + 1))).toBeNull();
  });
});
