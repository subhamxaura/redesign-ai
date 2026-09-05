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

For Vercel production, set the same three variables in **Project → Settings → Environment Variables**:
- `GEMINI_API_KEY`
- `NEXTAUTH_SECRET` (≥32 chars)
- `NEXTAUTH_URL` = `https://your-domain.vercel.app`

No database is required for local development — users are stored in `data/users.json` and anonymous free-use counts in `data/anon-usage.json` (both gitignored, file-based + in-memory cache, bcrypt-hashed passwords, HttpOnly JWT).

For **production on Vercel**, the filesystem is ephemeral and there are many serverless instances, so configure Upstash Redis (serverless-friendly, free tier works) in **Project → Settings → Environment Variables**:

- `UPSTASH_REDIS_REST_URL=https://<id>.upstash.io`
- `UPSTASH_REDIS_REST_TOKEN=<token>`

When set, both user accounts and anonymous usage counters persist in Redis with atomic increments — logins survive redeploys and the 3-free-use limit is enforced across all instances. When unset, the app falls back to file + memory (fine locally, best-effort on Vercel).

## Development

```bash
npm run dev
npm run lint
npm run typecheck
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
