# ReDesignAI Engineering Audit Report

**Repository:** `https://github.com/subhamxaura/redesign-ai`  
**Auditor:** Principal Software Engineer, Application Security Reviewer, and System Architect  
**Audit Date:** October 2026  
**Status:** Completed (Read-Only Baseline Audit)  

---

## 1. Executive Summary

ReDesignAI is a Next.js application that accepts a website or web application screenshot, leverages Google's Gemini multimodal models to perform an automated visual and UX critique, and generates a structured, themed redesign specification rendered in an interactive frontend preview.

While the application features a polished visual aesthetic and cohesive user experience on the client side, the underlying architecture contains critical architectural and engineering defects that prevent it from being production-ready, reliable, or secure.

### Key Audit Findings Overview
1. **Critical Authentication Fallback:** When `NEXTAUTH_SECRET` is missing in production, the application logs a warning and falls back to a deterministic, hardcoded secret (`dev-fallback-secret-please-set-NEXTAUTH_SECRET-32chars!!`), allowing arbitrary JWT session token forgery and complete account takeover.
2. **Unmetered & Public AI Endpoints:** Both `/api/analyze` (multimodal image critique) and `/api/chat` (text assistant) have zero authentication, zero quota enforcement, and zero rate limiting. Anyone on the public internet can trigger continuous, expensive Gemini API calls without restriction.
3. **Trivially Bypassable Anonymous Quota:** The 3-free-use limit relies exclusively on an unsigned, client-controlled cookie (`rdai_anon`). Rotating or omitting this cookie allows infinite free redesign generations.
4. **Vulnerable File Upload Validation:** File validation relies exclusively on the client-supplied HTTP `Content-Type` header without inspecting file magic bytes. Furthermore, the 10 MB limit exceeds Vercel's 4.5 MB serverless payload limit.
5. **Direct AI Prompt Injection:** Untrusted client input in `formData.get("analysis")` is concatenated directly into Gemini prompts in `/api/generate` without sanitization, delimiter framing, or length constraints.
6. **Double-Upload Bandwidth Waste:** The frontend studio uploads the full screenshot twice over the network: once to `/api/analyze` and immediately again to `/api/generate`.
7. **Severe Serverless Data Consistency & Ephemerality Deficiencies:** When Upstash Redis is unconfigured, the application attempts to write user accounts and quota counters to the local filesystem (`data/` or `/tmp/`). On Vercel, `process.cwd()` is read-only, and `/tmp` is wiped across lambdas and cold starts. When Redis is configured, `redisSet` encodes full JSON payloads into URL paths (`/set/key/value`), which risks HTTP 414 URI Too Long truncation.
8. **TypeScript & Convention Failures:** `npm run typecheck` (`tsc --noEmit`) fails with 47 compilation errors due to module resolution mismatches. Next.js 16 emits deprecation warnings on `middleware.ts` in favor of `proxy`.
9. **Zero Automated Tests:** The repository has 0% automated test coverage (no unit tests, no integration tests, no end-to-end tests) and no CI/CD pipeline.

---

## 2. Repository Structure & Component Map

```
redesign-ai/
├── .freebuff/                     # Project metadata
├── .gitignore                     # Git ignore rules (includes data/, tmp/, .env*)
├── AGENTS.md                      # Next.js 16 agent rules and guidelines
├── CLAUDE.md                      # Claude guidelines
├── README.md                      # Project documentation and setup instructions
├── eslint.config.mjs              # ESLint flat config (overrides no-img-element)
├── middleware.ts                  # Edge middleware protecting /dashboard & /profile (Deprecated convention)
├── next-env.d.ts                  # Next.js TypeScript definitions
├── next.config.ts                 # Next.js configuration (empty)
├── package.json                   # Dependencies, scripts, and engine specifications
├── tsconfig.json                  # TypeScript compiler configuration
├── data/                          # Git-ignored local file store fallback (users.json, anon-usage.json)
└── app/
    ├── layout.tsx                 # Root layout with Geist fonts & AuthProvider
    ├── globals.css                # Global styles and Tailwind CSS imports
    ├── error.tsx                  # Global error boundary component
    ├── loading.tsx                # Global loading state component
    ├── not-found.tsx              # 404 page
    ├── page.tsx                   # Public marketing landing page
    ├── api/
    │   ├── analyze/route.ts       # POST: Multimodal Gemini screenshot critique (UNMETERED)
    │   ├── auth/
    │   │   ├── [...nextauth]/route.ts  # NextAuth GET/POST credential handler
    │   │   └── signup/route.ts         # POST: Account registration with in-memory IP rate limiter
    │   ├── chat/route.ts          # POST: Gemini AI chatbot (UNMETERED)
    │   ├── generate/route.ts      # POST: Structured redesign spec generator from image + analysis
    │   ├── redesign/route.ts      # POST: Legacy single-shot redesign generator
    │   └── usage/route.ts         # GET: Authoritative anonymous/auth usage status
    ├── components/
    │   ├── AuthProvider.tsx       # NextAuth SessionProvider wrapper
    │   ├── AuthShell.tsx          # Shared layout and backdrop for auth pages
    │   ├── Chat.tsx               # Floating AI assistant widget
    │   ├── FreeLimitModal.tsx     # Paywall modal triggered when free quota is reached
    │   └── RedesignPreview.tsx    # Interactive viewport switcher & live spec renderer
    ├── dashboard/
    │   ├── page.tsx               # Server component for user dashboard
    │   └── DashboardClient.tsx    # Client dashboard rendering metrics & mock redesign history
    ├── profile/
    │   ├── page.tsx               # Server component for user profile
    │   └── ProfileClient.tsx      # Client profile view displaying account metadata
    ├── redesign/
    │   └── page.tsx               # Core interactive redesign studio
    ├── signin/
    │   ├── page.tsx               # Sign-in page wrapper (Suspense)
    │   └── SignInClient.tsx       # Credentials sign-in form
    ├── signup/
    │   ├── page.tsx               # Sign-up page wrapper (Suspense)
    │   └── SignUpClient.tsx       # Registration form
    └── lib/
        ├── auth.ts                # NextAuth configuration and credentials provider
        ├── authSecret.ts          # Shared secret resolver (VULNERABLE dev fallback)
        ├── freeUsage.ts           # Anonymous usage quota tracker & cookie manager
        ├── gemini.ts              # Google GenAI client, retry loop, error mapper, upload validator
        ├── redesign.ts            # Redesign schema, coercion logic, and JSON parsing
        ├── redesigns.ts           # Stubbed user redesign history (returns empty array)
        ├── store.ts               # Upstash Redis REST wrapper with local JSON file fallback
        └── users.ts               # User repository with bcrypt hashing and file/Redis persistence
```

---

## 3. Dependency & Environment Analysis

### 3.1 Dependencies (`package.json`)
```json
{
  "dependencies": {
    "@google/genai": "^2.21.0",
    "bcryptjs": "^3.0.3",
    "framer-motion": "^13.2.0",
    "next": "16.3.0",
    "next-auth": "^4.24.15",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-markdown": "^10.1.0",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.0",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### 3.2 Observed Dependency & Framework Conflicts
1. **Next.js & Installed Runtime Discrepancy:**
   - `package.json` specifies `"next": "16.3.0"`.
   - `node_modules/next/package.json` contains version `16.4.2`.
   - During `npm run build`, Next.js emits:
     ```
     ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
     To migrate automatically, run: npx @next/codemod@canary middleware-to-proxy .
     ```
2. **NextAuth v4 with React 19 & Next.js 16:**
   - `next-auth` version is `^4.24.15`.
   - NextAuth v4 is designed around older Next.js / React paradigms. In Next.js 16 App Router, Auth.js (v5) is the officially supported architecture for App Router route handlers and server actions.
   - Credentials provider sessions currently bypass database adapters and rely on custom `app/lib/users.ts` lookups.
3. **Zod Version Inconsistency:**
   - `package.json` lists `"zod": "^4.5.4"`.
   - Zod v4 is currently in preview/canary. Most schema validation in the project (`app/lib/redesign.ts`, `app/lib/users.ts`) does not even use Zod, relying instead on manual procedural checking, making the dependency largely redundant.
4. **Vulnerability Audit (`npm audit`):**
   - 8 High-severity vulnerabilities detected:
     - `brace-expansion` (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p): CPU denial of service via uncontrolled recursion.
     - `braces` (GHSA-vfj7-8cjw-p6xm): Denial of service through deeply nested patterns via `micromatch` / `fast-glob` / `eslint-config-next`.
     - `js-yaml` (GHSA-2883-xcg3-v3hh): Max total merge keys CPU exhaustion.
     - `source-map-js` (GHSA-68fv-2mgg-jv7q): Event loop denial of service via indexed source-map offsets.

---

## 4. Verification Commands & Observed Results

| Check | Command Executed | Exit Code | Observed Output / Status |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit --pretty false`) | `1` (FAIL) | 47 errors. Standalone `tsc` failed to resolve Next.js exports (`next/server`, `next/link`, `next/navigation`) due to `moduleResolution: bundler` configuration issues. Also identified null/undefined narrowing issues in `app/dashboard/page.tsx` and `app/profile/page.tsx`. |
| **ESLint** | `npm run lint` (`eslint`) | `0` (PASS) | Clean exit without linting errors (noting `@next/next/no-img-element` is explicitly suppressed in `eslint.config.mjs`). |
| **Dependency Audit** | `npm audit` | `1` (FAIL) | 8 high-severity CVEs identified in transitive dependencies (`brace-expansion`, `braces`, `js-yaml`, `source-map-js`). |
| **Production Build** | `npm run build` (`next build`) | `0` (PASS) | Build succeeded in 12.6s. Generated static pages (`/`, `/redesign`, `/signin`, `/signup`) and dynamic server functions (`/api/*`, `/dashboard`, `/profile`). Emitted deprecation warning for `middleware.ts`. |
| **Git Status** | `git status` | `0` (CLEAN) | Clean working tree on `master` branch. Zero untracked or modified files. |
| **Test Suite Check** | Search for `*test*`, `*spec*` in `app/` | `0` | No test files found. Zero automated tests exist in the project. |

---

## 5. Architectural & System Analysis

### 5.1 Route Handlers & Data Access Pattern
The application provides six API routes under `app/api/`:
- `/api/analyze/route.ts`: Public, unmetered endpoint accepting `multipart/form-data` with an image. Submits image to Gemini for Markdown critique.
- `/api/generate/route.ts`: Public endpoint accepting image and client-provided analysis string. Checks quota cookie for anonymous users, reserves 1 slot, calls Gemini with structured JSON schema, refunds slot on failure.
- `/api/redesign/route.ts`: Legacy single-shot endpoint duplicating `/api/generate` logic without intermediate analysis.
- `/api/chat/route.ts`: Public, unmetered endpoint accepting `{ message: string }` and submitting directly to Gemini.
- `/api/usage/route.ts`: GET endpoint returning remaining quota. Sets `rdai_anon` cookie.
- `/api/auth/signup/route.ts`: POST endpoint accepting user credentials, running an in-memory IP check, and creating an account.

### 5.2 Serverless Deployment & Ephemeral Filesystem Breakdown
In a serverless platform such as Vercel:
- **Filesystem Immutability:** `process.cwd()` is mounted as a read-only filesystem. Calling `fs.mkdir(path.join(process.cwd(), "data"))` throws `EROFS: read-only file system`.
- **Ephemeral `/tmp` Isolation:** While `/tmp` is writable, each serverless invocation may run in an isolated execution sandbox. State written to `/tmp/redesign-ai-data` is not shared across lambda instances and is destroyed on container termination.
- **Consequence:** If deployed without Upstash Redis, accounts created on one serverless instance do not exist on other instances, logins fail intermittently, and anonymous quotas reset randomly on container spin-up.

### 5.3 Upstash Redis REST Implementation Defects
In `app/lib/store.ts`:
```typescript
export async function redisSet(
  key: string,
  value: string,
  opts?: { nx?: boolean; exSeconds?: number }
): Promise<boolean> {
  let p = `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  if (opts?.nx) p += "/NX";
  if (opts?.exSeconds) p += `/EX/${opts.exSeconds}`;
  const result = await redisCall(p);
  return result === "OK";
}
```
- **URL Path Parameter Encoding Bug:** In Upstash Redis REST API, using `/set/<key>/<value>` places the entire value string directly into the URL path.
- When `createUser` calls `redisSet(userKey(email), JSON.stringify(user))`, the entire JSON object is URL-encoded into the request path.
- Standard web proxies, Cloudflare, and Node.js `fetch` enforce HTTP path limits (typically 2KB–4KB). Storing large JSON objects, history arrays, or prompt caches via path parameters causes HTTP 414 (URI Too Long) errors or silent write failures.
- The standard, safe Upstash REST invocation is sending a JSON body with the command array: `POST /` with `body: JSON.stringify(["SET", key, value, ...opts])`.

### 5.4 Redundant Network Uploads & Latency Impact
In `app/redesign/page.tsx`:
1. The user selects a screenshot (up to 10 MB).
2. The client sends a `POST` request to `/api/analyze` with the image in `FormData` (Upload #1).
3. Upon receiving the critique Markdown, the client immediately constructs a second `FormData` object containing the exact same image plus the analysis string and sends a `POST` request to `/api/generate` (Upload #2).
4. **Impact:** For a 5 MB image on a 10 Mbps mobile connection, upload latency is doubled from ~4 seconds to ~8 seconds, and cloud ingress data is doubled needlessly.

### 5.5 Fake / Stubbed Redesign History
In `app/dashboard/page.tsx`:
```typescript
const redesigns = await getRecentRedesignsForUser(user?.id ?? ...);
```
In `app/lib/redesigns.ts`:
```typescript
export async function getRecentRedesignsForUser(_userId: string): Promise<StoredRedesign[]> {
  void _userId;
  return [];
}
```
- Redesigns generated by logged-in users are NEVER persisted.
- The dashboard always displays "No redesigns yet" regardless of how many concepts a user creates.
- The UI advertises: "Your generated concepts — stored per-account when history is enabled", but the persistence layer is entirely absent.

---

## 6. Engineering Findings Catalog

### [ENG-01] TypeScript Typecheck Fails with 47 Errors on Standalone Execution
- **Severity:** High
- **Category:** Build & Tooling Integrity
- **Evidence:**
  - File: [package.json](file:///c:/Users/SUBHAM/redesign-ai/package.json#L10) (`"typecheck": "tsc --noEmit --pretty false"`)
  - File: [tsconfig.json](file:///c:/Users/SUBHAM/redesign-ai/tsconfig.json#L10-L11)
  - Command output:
    ```
    app/api/analyze/route.ts(1,30): error TS2307: Cannot find module 'next/server' or its corresponding type declarations.
    app/dashboard/page.tsx(19,17): error TS18047: 'session' is possibly 'null'.
    app/profile/page.tsx(19,37): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string'.
    ```
- **Impact:** Prevents standard CI type checking from passing. Developers cannot rely on `npm run typecheck` in pre-commit hooks or pull request checks.
- **Reproduction:** Run `npm run typecheck` in terminal.
- **Recommended Fix:**
  1. Update `tsconfig.json` compiler options to include proper Next.js type resolution rules (`moduleResolution: "bundler"`, ensure `plugins: [{ name: "next" }]` and path definitions match Next 16 conventions).
  2. Add proper null-guards in `app/dashboard/page.tsx` and `app/profile/page.tsx` after `getServerSession`:
     ```typescript
     if (!session?.user?.email) redirect("/signin?callbackUrl=/dashboard");
     const email = session.user.email; // TypeScript needs explicit assertion or narrowing
     ```
- **Acceptance Criteria:** `npm run typecheck` passes cleanly with exit code `0` and zero errors.

---

### [ENG-02] Deprecated Next.js Middleware Convention (`middleware.ts`)
- **Severity:** Medium
- **Category:** Framework Compliance
- **Evidence:**
  - File: [middleware.ts](file:///c:/Users/SUBHAM/redesign-ai/middleware.ts#L1-L71)
  - `npm run build` output:
    ```
    ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
    To migrate automatically, run: npx @next/codemod@canary middleware-to-proxy .
    ```
  - User Rule: `AGENTS.md` explicitly warns of Next.js breaking changes and instructs compliance with latest Next.js 16 conventions.
- **Impact:** Future Next.js 16 minor/patch updates may drop backward compatibility for `middleware.ts`, causing routing, redirect, and auth gates to fail in production.
- **Reproduction:** Run `npm run build` and observe stderr warnings.
- **Recommended Fix:** Migrate `middleware.ts` to the new Next.js 16 `proxy` architecture per official Next.js documentation.
- **Acceptance Criteria:** `npm run build` completes without the `middleware` deprecation warning.

---

### [ENG-03] Double-Upload Latency & Bandwidth Inefficiency in Redesign Studio Flow
- **Severity:** Medium
- **Category:** Performance & Network Optimization
- **Evidence:**
  - File: [app/redesign/page.tsx](file:///c:/Users/SUBHAM/redesign-ai/app/redesign/page.tsx#L201-L218)
  - Line 201: `fetch("/api/analyze", { method: "POST", body: fd })` (uploads screenshot)
  - Line 218: `fetch("/api/generate", { method: "POST", body: rfd })` (uploads identical screenshot again)
- **Impact:** Doubled network transit time and data consumption for users, especially on slow or metered mobile devices. Increased infrastructure ingress costs.
- **Reproduction:** Open network inspector in browser, upload a 5 MB image on `/redesign`, click "Analyze and redesign". Observe two sequential POST requests each uploading 5 MB of multipart form data.
- **Recommended Fix:** Either:
  1. Unify the workflow into a single endpoint (or streaming pipeline) that processes both stages server-side from one upload.
  2. Or, store the image temporarily in server memory/cache (or object store / signed URL) on the first upload and pass an image token/ID to `/api/generate`.
- **Acceptance Criteria:** A single user redesign execution uploads the original image file over the network exactly once.

---

### [ENG-04] Redesign History Is Completely Unimplemented
- **Severity:** Medium
- **Category:** Functionality & Architecture
- **Evidence:**
  - File: [app/lib/redesigns.ts](file:///c:/Users/SUBHAM/redesign-ai/app/lib/redesigns.ts#L17-L20)
    ```typescript
    export async function getRecentRedesignsForUser(_userId: string): Promise<StoredRedesign[]> {
      void _userId;
      return [];
    }
    ```
  - File: [app/api/generate/route.ts](file:///c:/Users/SUBHAM/redesign-ai/app/api/generate/route.ts#L208-L224)
    Generations are never saved to user storage upon completion.
- **Impact:** Authenticated users expect redesign history to persist as promised in dashboard UI copy ("stored per-account when history is enabled"). Currently, all work is lost as soon as the tab is closed.
- **Reproduction:** Log in as an authenticated user, generate a redesign on `/redesign`, navigate to `/dashboard`. Observe that recent redesigns list is always empty.
- **Recommended Fix:** Implement a persistence store for redesign metadata (ID, userId, title, timestamp, design spec, theme tokens). If using Redis, store under `rdai:history:<userId>` (or relational database `Redesign` table).
- **Acceptance Criteria:** Completed redesigns created by an authenticated user appear in `/dashboard` and can be retrieved across sessions.

---

### [ENG-05] Missing Automated Test Suite & CI/CD Pipeline
- **Severity:** High
- **Category:** Quality Assurance & Maintainability
- **Evidence:**
  - `package.json` contains no test scripts (`jest`, `vitest`, `playwright`, etc.).
  - Search across repository confirms 0 test files exist.
  - `.github/` folder is absent; no GitHub Actions workflows exist for lint, test, or build verification.
- **Impact:** Regressions cannot be detected automatically. Any refactoring or dependency update risks silent breaks in authentication, quota counting, or prompt handling.
- **Reproduction:** Run `npm test` -> exits with `Missing script: "test"`.
- **Recommended Fix:**
  1. Install `vitest` and setup unit tests for `app/lib/freeUsage.ts`, `app/lib/users.ts`, `app/lib/gemini.ts`, and `app/lib/redesign.ts`.
  2. Setup API route integration tests with mock Gemini and Redis fixtures.
  3. Create `.github/workflows/ci.yml` running lint, typecheck, tests, and build on every PR.
- **Acceptance Criteria:** `npm test` executes a comprehensive automated test suite with high coverage over critical business logic and CI runs on PRs.

---

### [ENG-06] Absence of Execution Timeout Configuration for Serverless Gemini Calls
- **Severity:** High
- **Category:** Serverless Reliability
- **Evidence:**
  - File: [app/api/analyze/route.ts](file:///c:/Users/SUBHAM/redesign-ai/app/api/analyze/route.ts)
  - File: [app/api/generate/route.ts](file:///c:/Users/SUBHAM/redesign-ai/app/api/generate/route.ts)
  - [app/lib/gemini.ts](file:///c:/Users/SUBHAM/redesign-ai/app/lib/gemini.ts#L120-L160) (`withGeminiRetry` performs up to 3 retries with exponential backoff: 500ms, 1s, 2s + jitter + retryAfter).
- **Impact:** Vercel Hobby tier defaults to a 10-second serverless execution limit (Pro allows up to 60s/300s with explicit configuration). A multimodal image analysis combined with retries routinely exceeds 10 seconds, causing Vercel to terminate the lambda with a `504 Gateway Timeout`.
- **Reproduction:** Trigger `/api/analyze` during peak Gemini API latency or simulated 503 retry. On standard Vercel defaults, the function times out.
- **Recommended Fix:** Add `export const maxDuration = 60;` (or maximum allowed for target plan) in `app/api/analyze/route.ts`, `app/api/generate/route.ts`, and `app/api/redesign/route.ts`.
- **Acceptance Criteria:** All AI route handlers declare explicit `maxDuration` settings aligned with target deployment tier.

---

### [ENG-07] Image Optimization Disabled & Missing `<Image />` Component
- **Severity:** Low
- **Category:** Frontend Performance & Best Practices
- **Evidence:**
  - File: [eslint.config.mjs](file:///c:/Users/SUBHAM/redesign-ai/eslint.config.mjs#L10) (`"@next/next/no-img-element": "off"`)
  - File: [app/components/RedesignPreview.tsx](file:///c:/Users/SUBHAM/redesign-ai/app/components/RedesignPreview.tsx#L206) (`<img src={imageUrl} ... />`)
  - File: [app/redesign/page.tsx](file:///c:/Users/SUBHAM/redesign-ai/app/redesign/page.tsx#L347) (`<img src={imageUrl} ... />`)
- **Impact:** Bypasses Next.js automatic image optimization, responsive sizing, modern format conversion (AVIF), and lazy loading.
- **Reproduction:** Inspect DOM in `/redesign` studio; standard unoptimized `<img>` tags are rendered.
- **Recommended Fix:** While blob URLs in the interactive studio are temporary client objects, static assets and user previews should use `next/image` where appropriate, and ESLint rule should be scoped rather than globally disabled.
- **Acceptance Criteria:** Static and remote images utilize `next/image` with proper `width`, `height`, and `alt` properties.

---

### [ENG-08] In-Memory Rate Limiter Memory Leak in Long-Running Node Environments
- **Severity:** Medium
- **Category:** Memory Management & Reliability
- **Evidence:**
  - File: [app/lib/users.ts](file:///c:/Users/SUBHAM/redesign-ai/app/lib/users.ts#L194-L212)
    ```typescript
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
    export function checkRateLimit(key: string, max: number, windowMs: number) {
      const now = Date.now();
      const entry = rateLimitMap.get(key);
      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        ...
      }
    }
    ```
- **Impact:** Keys are added to `rateLimitMap` on every request from a new IP/key. Stale entries are overwritten only when the same key repeats, but keys that never repeat are never deleted. Over time in a persistent Node server, this causes an unbounded memory leak.
- **Reproduction:** Simulate 100,000 unique IP sign-up requests; inspect `rateLimitMap.size`; observe that size continuously increases without garbage collection.
- **Recommended Fix:** Add periodic cleanup of expired keys or use an LRU cache with max capacity (or delegate rate limiting to Redis).
- **Acceptance Criteria:** Expired rate limit entries are evicted automatically, and memory footprint remains bounded.
