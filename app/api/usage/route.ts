import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import {
  FREE_LIMIT,
  applyAnonCookie,
  getAnonIdFromCookieHeader,
  getFreeUsage,
  isValidAnonId,
  newAnonId,
} from "@/app/lib/freeUsage";

export const runtime = "nodejs";

/**
 * GET /api/usage — server-authoritative free-use status for the redesign UI.
 * Authenticated users: { authenticated: true } (no anonymous gate applies).
 * Anonymous users: { usage, remaining, limit } + sets the HttpOnly anon cookie.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      return NextResponse.json({
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

    const res = NextResponse.json({
      authenticated: false,
      usage,
      remaining,
      limit,
      limitReached: remaining <= 0,
    });
    // Always (re)assert the cookie so anonymous browsers keep a stable ID.
    // Re-setting an existing valid ID is harmless and self-heals expiry.
    applyAnonCookie(res, anonId);
    return res;
  } catch (error) {
    console.error("Usage status error:", error);
    return NextResponse.json(
      { authenticated: false, usage: 0, remaining: FREE_LIMIT, limit: FREE_LIMIT },
      { status: 200 }
    );
  }
}
