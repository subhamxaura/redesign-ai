import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/app/lib/authSecret";
import { safeCallbackPath } from "@/app/lib/redirects";

// /redesign is intentionally PUBLIC — anonymous visitors get 3 free
// server-enforced generations before any sign-in wall.
const PROTECTED = ["/dashboard", "/profile"];
const AUTH_PAGES = ["/signin", "/signup"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    secureCookie: process.env.NODE_ENV === "production",
  });

  const isAuthed = Boolean(token);

  if (isProtected(pathname) && !isAuthed) {
    const callback = safeCallbackPath(`${pathname}${request.nextUrl.search}`);
    const url = new URL("/signin", request.url);
    url.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(url);
  }

  if (isAuthPage(pathname) && isAuthed) {
    const callback = safeCallbackPath(searchParams.get("callbackUrl"));
    return NextResponse.redirect(new URL(callback, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/signin", "/signup"],
};
