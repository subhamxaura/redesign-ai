// Edge-safe shared secret helper (no Node-only imports).
// Imported by `app/lib/auth.ts`, `proxy.ts`, and server-side signing helpers so
// the JWT secret used to SIGN sessions and the secret used to VERIFY them can
// never drift apart.

const DEV_FALLBACK_SECRET = "dev-fallback-secret-please-set-NEXTAUTH_SECRET-32chars!!";
const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (secret && secret.length >= MIN_PRODUCTION_SECRET_LENGTH) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    // Never sign production sessions with a known fallback or a weak secret.
    throw new Error(
      "NEXTAUTH_SECRET must be set to at least 32 characters before starting in production."
    );
  }

  // Deterministic local-development fallback only. Never used in production.
  return secret || DEV_FALLBACK_SECRET;
}
