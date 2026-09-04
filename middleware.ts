import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED = ["/redesign", "/dashboard", "/profile"];
const AUTH_PAGES = ["/signin", "/signup"];

function isProtected(pathname: string) {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function safeCallbackUrl(value: string | null): string | null {
  if (!value) return null;
  // Only allow relative paths starting with / and not //, and not containing \ or :
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes(":") || value.includes("%5c")) return null;
  // Allow only known app paths or root
  if (value === "/" || PROTECTED.some((p) => value === p || value.startsWith(`${p}/`) || value.startsWith(`${p}?`))) {
    return value;
  }
  // Also allow /dashboard etc. but be permissive for internal paths that are safe relative
  if (/^\/[a-zA-Z0-9\/\-_?=&%]*$/.test(value) && !value.includes("..")) return value;
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthed = !!token;

  // Protect authenticated routes
  if (isProtected(pathname) && !isAuthed) {
    const callback = `${pathname}${request.nextUrl.search}`;
    const safeCb = safeCallbackUrl(callback) ?? "/dashboard";
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", safeCb);
    return NextResponse.redirect(url);
  }

  // Redirect authed users away from signin/signup (unless they explicitly want)
  if (isAuthPage(pathname) && isAuthed) {
    const cb = safeCallbackUrl(searchParams.get("callbackUrl"));
    const url = request.nextUrl.clone();
    url.pathname = cb ?? "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/redesign/:path*", "/dashboard/:path*", "/profile/:path*", "/signin", "/signup"],
};
