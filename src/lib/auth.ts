import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { NextResponse } from "next/server";
import {
  getJwtUserCache,
  invalidateJwtUserCache,
  setJwtUserCache,
} from "@/lib/jwt-user-cache";

interface ExtendedUser {
  id: string;
  role: string;
  sessionVersion: number;
}

interface ExtendedJWT extends JWT {
  role?: string;
  id?: string;
  sessionVersion?: number;
}

export interface ExtendedSession extends Session {
  user: {
    id: string;
    role: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Precomputed bcrypt hash (cost 12) used only to equalize timing for accounts
// that cannot be verified (unknown email, inactive user, missing password).
// Must remain a valid bcrypt hash so compare() actually performs the work.
const TIMING_EQUALIZER_HASH =
  "$2b$12$NosL3wYlZa2RAIT5TD1g/.SaFLesWAk3.VJSDvVRIeTUecs9TeC1a";

// Short-lived cache for JWT callback DB lookups — avoids a query per request
// while still catching role/deactivation changes within 5 minutes.
// Note: this means a user demoted from admin to student will retain admin
// access for up to 5 minutes unless the entry is invalidated explicitly. Every
// path that changes a cached field (password reset/change, 2FA toggle, admin
// demotion, account erasure) calls `invalidateJwtUserCache`, so a stolen token
// dies immediately rather than within the TTL.
// The cache lives in its own module so those paths do not import NextAuth.

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
        twoFactorCode: { label: "Код 2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Введите email и пароль");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        // Run a dummy password comparison even for unknown or inactive
        // accounts so response time does not reveal which emails are
        // registered.
        if (!user || !user.isActive) {
          await verifyPassword(credentials.password, TIMING_EQUALIZER_HASH).catch(() => false);
          throw new Error("Неверный email или пароль");
        }

        if (!user.passwordHash) {
          await verifyPassword(credentials.password, TIMING_EQUALIZER_HASH).catch(() => false);
          throw new Error("Неверный email или пароль");
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Неверный email или пароль");
        }

        if (user.twoFactorEnabled && !credentials.twoFactorCode) {
          throw new Error("REQUIRES_2FA");
        }

        if (user.twoFactorEnabled && credentials.twoFactorCode) {
          if (!user.twoFactorSecret || !authenticator.verify({ token: credentials.twoFactorCode, secret: user.twoFactorSecret })) {
            throw new Error("Неверный код 2FA");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },
  callbacks: {
    async jwt({ token, user }): Promise<ExtendedJWT> {
      const extendedToken = token as ExtendedJWT;
      if (user) {
        extendedToken.role = (user as ExtendedUser).role;
        extendedToken.id = user.id;
        extendedToken.sessionVersion = (user as ExtendedUser).sessionVersion;
      }
      // Refresh role from DB to catch demotions/deactivations (cached 5 min)
      if (extendedToken.id) {
        let dbUser = getJwtUserCache(extendedToken.id);

        if (!dbUser) {
          const fresh = await db.user.findUnique({
            where: { id: extendedToken.id },
            select: { role: true, isActive: true, sessionVersion: true },
          });
          if (fresh) {
            dbUser = fresh;
            setJwtUserCache(extendedToken.id, fresh);
          } else {
            invalidateJwtUserCache(extendedToken.id);
          }
        }

        if (!dbUser || !dbUser.isActive) {
          invalidateJwtUserCache(extendedToken.id);
          return {} as ExtendedJWT;
        }

        // A password reset or a 2FA change bumps the version, which retires
        // every token issued before it. Tokens minted before this field existed
        // have no version and are treated as stale for the same reason.
        if (extendedToken.sessionVersion !== dbUser.sessionVersion) {
          invalidateJwtUserCache(extendedToken.id);
          return {} as ExtendedJWT;
        }

        extendedToken.role = dbUser.role;
      }
      return extendedToken;
    },
    async session({ session, token }): Promise<ExtendedSession> {
      const extendedToken = token as ExtendedJWT;
      const extendedSession = session as ExtendedSession;
      if (extendedSession.user) {
        extendedSession.user.role = extendedToken.role ?? "";
        extendedSession.user.id = extendedToken.id ?? "";
      }
      return extendedSession;
    },
  },
  pages: {
    signIn: "/#login",
  },
  // Explicit cookie configuration for security
  // useSecureCookies ensures Secure flag in production; SameSite=Strict prevents CSRF
  cookies: {
    sessionToken: {
      name: env.isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: env.isProduction,
      },
    },
  },
  useSecureCookies: env.isProduction,
  secret: env.nextAuthSecret,
};

// Validate NEXTAUTH_SECRET at runtime — insecure default is dangerous in production.
// Log a loud error instead of throwing at module scope: throwing here would crash
// every route that imports this module, taking down the whole site. Without the
// secret, auth calls fail individually with NextAuth's own clear error.
if (env.isProduction && env.nextPhase !== "phase-production-build") {
  const secret = env.nextAuthSecret;
  if (!secret || secret.trim() === "") {
    log.error(
      "NEXTAUTH_SECRET is not set in production. Authentication will be unavailable. " +
        "Generate one with: openssl rand -base64 32 and set it in the platform environment variables.",
    );
  }
}

/**
 * Typed wrapper for getServerSession to avoid repeating
 * `as ExtendedSession | null` across API routes.
 */
export async function getAuthSession(): Promise<ExtendedSession | null> {
  return getServerSession(authOptions) as Promise<ExtendedSession | null>;
}

/**
 * Type-predicate: checks if user is authenticated.
 * After a truthy return, session.user is guaranteed to exist.
 */
export function requireAuth(session: ExtendedSession | null): session is ExtendedSession {
  // A deactivated user's JWT collapses to "{}", producing a session whose
  // user object has an empty id; that must count as unauthenticated.
  return (
    !!session?.user &&
    typeof session.user.id === "string" &&
    session.user.id.length > 0
  );
}

/**
 * Type-predicate: checks if user is authenticated and has admin role.
 * After a truthy return, session.user is guaranteed to exist with admin role.
 */
export function requireAdmin(session: ExtendedSession | null): session is ExtendedSession {
  return requireAuth(session) && session.user.role === "admin";
}

/** 401 error response for unauthenticated users */
export function authErrorResponse() {
  return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
}

/** 403 error response for non-admin users */
export function adminErrorResponse() {
  return NextResponse.json(
    { error: "Доступ запрещён. Требуются права администратора" },
    { status: 403 }
  );
}

export { hashPassword, verifyPassword };
