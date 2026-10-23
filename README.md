# ReDesignAI

ReDesignAI is a Next.js app that analyzes a website screenshot with Gemini and generates a practical redesign direction.

## Features

- Screenshot upload with PNG, JPG, and WEBP validation
- AI design audit with UI, UX, accessibility, and implementation notes
- Structured redesign preview with theme, layout, copy, and recommendations
- Floating assistant for redesign and frontend questions
- Secure authentication (NextAuth JWT + bcrypt) with protected studio routes
- Dashboard, profile, and auth-aware navigation

## Setup

Create `.env.local`:

```bash
GEMINI_API_KEY=your_api_key_here
NEXTAUTH_SECRET=your_32_char_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Optional Gemini model overrides:

```bash
GEMINI_MODEL=gemini-3.6-flash
GEMINI_STRUCTURED_MODEL=gemini-3.6-flash
```

For Vercel production, set at least these variables in **Project → Settings → Environment Variables**:
- `GEMINI_API_KEY`
- `NEXTAUTH_SECRET` (≥32 chars; production refuses to start without it)
- `NEXTAUTH_URL` = `https://your-domain.vercel.app`

No database is required for local development — users are stored in `data/users.json` and anonymous free-use counts in `data/anon-usage.json` (both gitignored, file-based + in-memory cache, bcrypt-hashed passwords, HttpOnly JWT).

## Production storage

Production **fails closed** (`503`) if durable storage is not configured. There is no silent ephemeral fallback.

Configure one option:

**Option A — Upstash Redis (recommended for Vercel/serverless):**
- `UPSTASH_REDIS_REST_URL=https://<id>.upstash.io`
- `UPSTASH_REDIS_REST_TOKEN=<token>`

**Option B — persistent volume (single instance):**
- `DURABLE_FILE_STORAGE=true`
- `REDESIGN_DATA_DIR=/mounted/persistent/path`

Redis stores accounts, anonymous usage, and rate-limit buckets with atomic operations. File storage is only safe for a single long-lived instance; it is not suitable for Vercel's ephemeral filesystem.

## Security and abuse controls

- Anonymous free-use identity is a server-signed HttpOnly cookie, backed by a keyed network bucket (`ANON_NETWORK_FREE_LIMIT`, default `12` per 30 days). Clearing cookies does not reset the network bucket.
- Login, signup, chat, analysis, and generation endpoints are rate limited through Redis or durable file storage.
- Uploads are checked by magic bytes, declared MIME, byte size, and image dimensions — not just the client-supplied file type.
- Gemini calls have finite retries, a per-attempt timeout (`GEMINI_REQUEST_TIMEOUT_MS`), bounded output, and generic public errors that do not expose provider details.
- If a trusted reverse proxy overwrites `x-forwarded-for`/`x-real-ip`, set `TRUST_PROXY_HEADERS=true`. Vercel's `x-vercel-forwarded-for` is trusted automatically.

## Development

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Open `http://localhost:3000`.

## Auth routes

- `/signup` — create account (name, email, password, confirm)
- `/signin` — sign in (supports `?callbackUrl=/redesign`)
- `/dashboard` — private, recent redesigns + usage
- `/profile` — private, account details + sign out
- `/redesign` — public, upload → analyze → redesign (anonymous users get 3 free server-enforced generations, then a sign-in wall)
- `GET /api/usage` — server-authoritative free-use status (`{ usage, remaining, limit }`)
