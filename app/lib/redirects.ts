export const DEFAULT_CALLBACK_PATH = "/dashboard";

const ALLOWED_CALLBACK_PREFIXES = ["/dashboard", "/profile", "/redesign"];
const MAX_CALLBACK_LENGTH = 512;

function isAllowedAppPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return ALLOWED_CALLBACK_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Accept only same-origin, app-owned relative paths as post-auth redirects.
 * Repeatedly decodes percent-encoding to catch encoded scheme/slash/backslash
 * tricks before validating the resulting path.
 */
export function safeCallbackPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_CALLBACK_PATH
): string {
  if (!value) return fallback;
  if (value.length > MAX_CALLBACK_LENGTH) return fallback;

  let candidate = value.trim();
  for (let i = 0; i < 3; i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      return fallback;
    }
    if (decoded === candidate) break;
    candidate = decoded;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\") || candidate.includes("\0") || /[\r\n\t]/.test(candidate)) return fallback;
  if (candidate.includes("..")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return fallback;

  let url: URL;
  try {
    url = new URL(candidate, "https://app.invalid");
  } catch {
    return fallback;
  }

  if (url.origin !== "https://app.invalid") return fallback;
  if (!isAllowedAppPath(url.pathname)) return fallback;

  return `${url.pathname}${url.search}`;
}
