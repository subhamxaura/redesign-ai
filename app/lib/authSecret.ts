// Edge-safe shared secret helper (no Node-only imports).
// Imported by both `app/lib/auth.ts` and `middleware.ts` so the JWT secret
// used to SIGN sessions (NextAuth) and the secret used to VERIFY them
// (middleware getToken) can never drift apart.

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "NEXTAUTH_SECRET is missing or weak. Set a 32+ character secret in .env.local and Vercel."
    );
  }
  // Deterministic dev fallback so local builds don't fail; overridden in prod.
  return secret || "dev-fallback-secret-please-set-NEXTAUTH_SECRET-32chars!!";
}
