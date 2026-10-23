import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { noStoreJson, enforceOrRateLimit, errorResponse } from "@/app/lib/api";
import {
  FREE_LIMIT,
  applyAnonCookie,
  getAnonIdFromCookieHeader,
  getFreeUsage,
  isValidAnonId,
  newAnonId,
} from "@/app/lib/freeUsage";
import { getRateLimitIdentity } from "@/app/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/usage — server-authoritative free-use status for the redesign UI.
 * Authenticated users: { authenticated: true } (no anonymous gate applies).
 * Anonymous users: { usage, remaining, limit } + sets the HttpOnly anon cookie.
 */
export async function GET(request: Request) {
  try {
    const rateLimitKey = getRateLimitIdentity(request);
    const limited = await enforceOrRateLimit([
      { key: `usage:${rateLimitKey}`, limit: 120, windowSeconds: 60 },
    ]);
    if (limited) return limited;

    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      return noStoreJson({
        authenticated: true,
        usage: 0,
        remaining: FREE_LIMIT,
        limit: FREE_LIMIT,
      });
    }

    let anonId = getAnonIdFromCookieHeader(request.headers.get("cookie"));
    if (!isValidAnonId(anonId)) {
      anonId = newAnonId();
    }

    const { usage, remaining, limit } = await getFreeUsage(anonId);

    const res = noStoreJson({
      authenticated: false,
      usage,
      remaining,
      limit,
      limitReached: remaining <= 0,
    });
    applyAnonCookie(res, anonId);
    return res;
  } catch (error: unknown) {
    return errorResponse(error, "Usage status is temporarily unavailable.");
  }
}
