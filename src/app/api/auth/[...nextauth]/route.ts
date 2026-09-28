import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

// Every POST on this route is an authentication action (credentials sign-in,
// callbacks, sign-out). Sign-in previously had no limiter at all, leaving
// password brute-force bounded only by bcrypt cost.
const checkLoginRateLimit = rateLimit("auth", RATE_LIMITS.login);

type AuthRouteContext = { params: Promise<{ nextauth: string[] }> };

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const blocked = checkLoginRateLimit(request);
  if (blocked) return blocked;
  const nextAuthHandler = handler as unknown as (
    req: NextRequest,
    ctx: AuthRouteContext,
  ) => Promise<Response>;
  return nextAuthHandler(request, context);
}

export { handler as GET };
