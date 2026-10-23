# ReDesignAI Testing Guide

This document describes how to run and write tests for ReDesignAI, including unit tests, API integration tests, and browser end-to-end tests.

## Test Commands

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint static analysis |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm run build` | Production Next.js build (Turbopack) |
| `npm test` | Unit + API integration tests (Vitest) |
| `npm run test:e2e` | Browser end-to-end tests (Playwright) |

## Baseline (all must pass in CI)

1. **Lint** — `npm run lint` — zero ESLint errors
2. **Type check** — `npm run typecheck` — zero TypeScript errors
3. **Build** — `npm run build` — successful production build
4. **Unit tests** — `npm test` — all 103 tests pass across 14 files
5. **E2E tests** — `npm run test:e2e` — all 8 Chromium tests pass

## Test Suite Structure

```
tests/
  api/
    signup.test.ts      — POST /api/auth/signup (validation, duplicates, rate limits, XSS)
    usage.test.ts       — GET /api/usage (authenticated vs anonymous, cookie handling)
    analyze.test.ts     — POST /api/analyze (image validation, oversized uploads, Gemini errors)
    generate.test.ts    — POST /api/generate (quota enforcement, refunds, auth bypass)
    chat.test.ts        — POST /api/chat (malformed JSON, oversized messages, prompt injection)
  freeUsage.test.ts     — Anonymous quota reservation, concurrency, refunds, network bucket
  gemini.test.ts        — Retry logic, error classification, response sanitization, prompt blocks
  http.test.ts          — JSON body parsing, same-origin enforcement, form data limits, client IP
  imageValidation.test.ts — Magic-byte detection, MIME matching, size/dimension limits
  rateLimit.test.ts     — Rate limiting buckets, atomicity under concurrency
  redesign.test.ts      — Redesign spec parsing/coercion (malformed JSON, oversized output)
  redirects.test.ts     — Safe callback path validation (open redirect prevention)
  store.test.ts         — Production durable storage guard
  validation.test.ts    — Zod schemas (signup, chat, analysis input)
  e2e/
    critical-journeys.spec.ts — Playwright browser tests (home, auth, protected routes, upload, chat)
```

## Environment Setup

### Local Development

1. Copy `.env.example` to `.env.local` and fill in values:

```
GEMINI_API_KEY=your_api_key_here
NEXTAUTH_SECRET=your_32_char_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

2. Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. Install dependencies:

```bash
npm ci
```

4. Run the full test suite:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### CI Environment

CI runs on GitHub Actions (`.github/workflows/ci.yml`). The following environment variables are set automatically:

- `DURABLE_FILE_STORAGE=true`
- `REDESIGN_DATA_DIR=/tmp/redesign-ci-data`
- `GEMINI_REQUEST_TIMEOUT_MS=5000`
- `NEXTAUTH_SECRET=ci-test-secret-that-is-at-least-32-characters-long`
- `NEXTAUTH_URL=http://localhost:3000`

No production secrets are required for CI — Gemini API calls are mocked in tests.

## Writing Tests

### Unit Tests (Vitest)

Place unit tests in `tests/` with the `*.test.ts` suffix. Use `vitest` globals (`describe`, `it`, `expect`, `vi`).

```ts
import { describe, expect, it } from "vitest";
import { someFunction } from "@/app/lib/someModule";

describe("someModule", () => {
  it("does something", () => {
    expect(someFunction()).toBe("expected");
  });
});
```

### API Integration Tests

API integration tests live in `tests/api/`. They import Next.js route handlers directly and call them with mock `Request` objects. Mock `next-auth` for session control and `@/app/lib/gemini` to avoid real AI calls.

```ts
import { POST as routePOST } from "@/app/api/some/route";
import { getServerSession } from "next-auth";

vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getServerSession: vi.fn() };
});

const mockedSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

mockedSession.mockResolvedValue(null); // unauthenticated
// or
mockedSession.mockResolvedValue({ user: { email: "user@example.com" } } as any);
```

### E2E Tests (Playwright)

E2E tests live in `tests/e2e/` and run against a locally started dev server. Use `page.setInputFiles()` for file uploads (bypasses hidden input overlays).

## Known Gaps

| Area | Status | Notes |
|------|--------|-------|
| Authenticated generate/redesign | Not tested | Requires a real NextAuth session cookie in API tests |
| E2E sign-up/sign-in flow | Not tested | Requires real email delivery / session persistence |
| Dependency vulnerabilities | 5 high | Transitive `braces` CVE via `eslint-config-next`; fix requires breaking Next.js upgrade |
| Redis storage tests | Not tested | No Redis available in CI; file-storage fallback is tested |
| Rate-limit HTTP headers | Partially tested | Unit tests cover rate limiting; API-level 429 headers not tested |

## Security Scanning

CI runs `npm audit --omit=dev --audit-level=high` so production dependency vulnerabilities fail the build. Known dev-only transitive vulnerabilities are reported separately and do not block CI.

## Adding New Tests

1. Create `tests/api/<route>.test.ts` for new API endpoints
2. Mock `next-auth` and `gemini` as shown above
3. Add tests for: valid input, malformed input, oversized input, unauthorized access, rate limits, error sanitization
4. Run `npm test` to verify
5. For E2E coverage, add to `tests/e2e/critical-journeys.spec.ts`
