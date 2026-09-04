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

No database is required for local auth — users are stored in `data/users.json` (gitignored, file-based + in-memory cache, bcrypt-hashed passwords, HttpOnly JWT). For team/production persistence, migrate `app/lib/users.ts` to Postgres/Prisma and add a Prisma adapter.

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
- `/redesign` — private, upload → analyze → redesign (redirects to `/signin?callbackUrl=/redesign` when logged out)
