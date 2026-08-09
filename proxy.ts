import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionData } from "@/lib/session";

/**
 * Coarse access control at the edge, so a request that isn't allowed is
 * turned away with a real HTTP redirect before any page renders. This is an
 * optimistic check only — requireUser/requireAdmin inside each page remain
 * the actual enforcement, as the Next.js docs advise.
 */

const ADMIN_ONLY = [
  /^\/stores(\/|$)/,
  /^\/users(\/|$)/,
  // /items is shared; every page below it (new, import, edit) is admin-only.
  /^\/items\/.+/,
];

const STORE_ONLY = [/^\/stock-in(\/|$)/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sealed = request.cookies.get("asm_session")?.value;

  let session: SessionData = {};
  if (sealed) {
    try {
      session = await unsealData<SessionData>(sealed, {
        password: process.env.SESSION_SECRET!,
      });
    } catch {
      // Tampered, expired or signed with an old secret — treat as signed out.
      session = {};
    }
  }

  if (!session.userId) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  const isAdmin = session.role === "ADMIN";
  const blocked =
    (!isAdmin && ADMIN_ONLY.some((r) => r.test(pathname))) ||
    (isAdmin && STORE_ONLY.some((r) => r.test(pathname)));

  if (blocked) return NextResponse.redirect(new URL("/", request.url));

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/items/:path*",
    "/receipts/:path*",
    "/reports/:path*",
    "/stock-in/:path*",
    "/stores/:path*",
    "/users/:path*",
  ],
};
