import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/app/lib/redirects";

describe("safeCallbackPath", () => {
  it("allows known internal paths", () => {
    expect(safeCallbackPath("/dashboard")).toBe("/dashboard");
    expect(safeCallbackPath("/profile?tab=security")).toBe("/profile?tab=security");
    expect(safeCallbackPath("/redesign")).toBe("/redesign");
    expect(safeCallbackPath("/")).toBe("/");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/dashboard");
    expect(safeCallbackPath("//evil.example")).toBe("/dashboard");
    expect(safeCallbackPath("/\\evil.example")).toBe("/dashboard");
    expect(safeCallbackPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects encoded bypass attempts", () => {
    expect(safeCallbackPath("//evil.example/%2e%2e")).toBe("/dashboard");
    expect(safeCallbackPath("/%2f%2fevil.example")).toBe("/dashboard");
    expect(safeCallbackPath("/%252f%252fevil.example")).toBe("/dashboard");
    expect(safeCallbackPath("/dashboard%5cevil")).toBe("/dashboard");
    expect(safeCallbackPath("/dashboard%0d%0aSet-Cookie:x=1")).toBe("/dashboard");
  });

  it("rejects paths outside the app allowlist", () => {
    expect(safeCallbackPath("/admin")).toBe("/dashboard");
    expect(safeCallbackPath("/api/auth/signout")).toBe("/dashboard");
  });

  it("rejects excessive length and malformed encoding", () => {
    expect(safeCallbackPath(`/${"a".repeat(600)}`)).toBe("/dashboard");
    expect(safeCallbackPath("/dashboard%")).toBe("/dashboard");
  });
});
