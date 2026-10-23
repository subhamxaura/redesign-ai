import NextAuth from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { enforceOrRateLimit, errorResponse } from "@/app/lib/api";
import { assertSameOrigin, getRateLimitIdentity } from "@/app/lib/http";

const handler = NextAuth(authOptions);

type RouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

const authHandler = handler as unknown as (
  request: Request,
  context: RouteContext
) => Promise<Response>;

export async function GET(request: Request, context: RouteContext) {
  return authHandler(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const rateLimitKey = getRateLimitIdentity(request);
    const limited = await enforceOrRateLimit([
      { key: `login-ip:${rateLimitKey}`, limit: 10, windowSeconds: 15 * 60 },
    ]);
    if (limited) return limited;
  } catch (error) {
    return errorResponse(error, "Invalid request.");
  }

  return authHandler(request, context);
}
