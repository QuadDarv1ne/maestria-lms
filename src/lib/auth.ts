import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
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
          where: { email: credentials.email },
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
          const { authenticator } = await import("otplib");
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
      if (user) {
        const extendedToken = token as ExtendedJWT;
        extendedToken.role = (user as ExtendedUser).role;
        extendedToken.id = user.id;
        return extendedToken;
      }
      return token as ExtendedJWT;
    },
    async session({ session, token }): Promise<ExtendedSession> {
      const extendedSession = session as ExtendedSession;
      if (extendedSession.user) {
        const extendedToken = token as ExtendedJWT;
        extendedSession.user.role = extendedToken.role ?? "";
        extendedSession.user.id = extendedToken.id ?? "";
      }
      return extendedSession;
    },
  },
  pages: {
    signIn: "/#login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Validate NEXTAUTH_SECRET at runtime — insecure default is dangerous in production
// Skip during build phase (build may run without full env, production server must have it)
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXTAUTH_SECRET &&
  !process.env.INIT_CWD?.includes("node_modules")
) {
  // Only validate when NEXTAUTH_SECRET is explicitly set but empty
  if (process.env.NEXTAUTH_SECRET.trim() === "") {
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
    return new Response(
      JSON.stringify({ error: "Доступ запрещён. Требуются права администратора" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}

export { hashPassword };
