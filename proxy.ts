import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default auth((request: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  if (request.nextUrl.pathname.startsWith("/admin") && request.auth?.user?.role !== "SUPER_ADMIN") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*"] };