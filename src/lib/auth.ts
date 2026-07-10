import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

interface ExtendedUser {
  id: string;
  role: string;
}

interface ExtendedJWT extends JWT {
  role?: string;
  id?: string;
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

// Short-lived cache for JWT callback DB lookups — avoids a query per request
// while still catching role/deactivation changes within 5 minutes.
const jwtUserCache = new Map<string, { role: string; isActive: boolean; expiresAt: number }>();
const JWT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const JWT_CACHE_MAX = 500;

function jwtCacheSet(id: string, data: { role: string; isActive: boolean }) {
  if (jwtUserCache.size >= JWT_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = jwtUserCache.keys().next().value;
    if (firstKey) jwtUserCache.delete(firstKey);
  }
  jwtUserCache.set(id, { ...data, expiresAt: Date.now() + JWT_CACHE_TTL });
}

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

        // Check isActive BEFORE password verification to prevent user enumeration
        // and avoid unnecessary computation for blocked accounts
        if (!user || !user.isActive) {
          throw new Error("Неверный email или пароль");
        }

        if (!user.passwordHash) {
          throw new Error("Неверный email или пароль");
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Неверный email или пароль");
        }

        if (user.twoFactorEnabled && !credentials.twoFactorCode) {
          throw new Error("ТРЕБУЕТСЯ_2FA");
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
      }
      // Refresh role from DB to catch demotions/deactivations (cached 5 min)
      if (extendedToken.id) {
        const now = Date.now();
        const cached = jwtUserCache.get(extendedToken.id);
        let dbUser: { role: string; isActive: boolean } | null = null;

        if (cached && cached.expiresAt > now) {
          dbUser = cached;
        } else {
          const fresh = await db.user.findUnique({
            where: { id: extendedToken.id },
            select: { role: true, isActive: true },
          });
          if (fresh) {
            dbUser = fresh;
            jwtCacheSet(extendedToken.id, fresh);
          } else {
            jwtUserCache.delete(extendedToken.id);
          }
        }

        if (!dbUser || !dbUser.isActive) {
          jwtUserCache.delete(extendedToken.id);
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

// Validate NEXTAUTH_SECRET at runtime — insecure default is dangerous in production
// Skip during build phase (build may run without full env, production server must have it)
if (
  env.isProduction &&
  !process.env.INIT_CWD?.includes("node_modules")
) {
  const secret = env.nextAuthSecret;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "NEXTAUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32"
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
 * Helper to check if user is authenticated.
 * Returns error response if not authorized.
 */
export function requireAuth(session: ExtendedSession | null) {
  if (!session?.user) {
    return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 });
  }
  return null;
}

/**
 * Helper to check if user is authenticated and has admin role.
 * Returns error response if not authorized.
 */
export function requireAdmin(session: ExtendedSession | null) {
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Доступ запрещён. Требуются права администратора" },
      { status: 403 }
    );
  }
  return null;
}

export { hashPassword };
