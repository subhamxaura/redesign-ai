import { NextResponse } from "next/server";
import { toPublicError } from "@/app/lib/errors";
import { enforceRateLimits, type RateLimitBucket, type RateLimitResult } from "@/app/lib/rateLimit";

export function errorResponse(error: unknown, fallback: string): NextResponse {
  const pub = toPublicError(error, fallback);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };

  if (pub.retryAfterSeconds && pub.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(pub.retryAfterSeconds);
  }

  return NextResponse.json({ error: pub.message }, { status: pub.status, headers });
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait before trying again.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
    }
  );
}

/**
 * Returns a 429 response when a bucket is exhausted, otherwise null.
 * Storage failures propagate so callers fail closed instead of silently
 * allowing unlimited requests.
 */
export async function enforceOrRateLimit(
  buckets: RateLimitBucket[]
): Promise<NextResponse | null> {
  const result = await enforceRateLimits(buckets);
  return result ? rateLimitResponse(result) : null;
}

export function noStoreJson<T>(body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
