import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

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
        (token as ExtendedJWT).role = (user as ExtendedUser).role;
        (token as ExtendedJWT).id = user.id;
      }
      return token as ExtendedJWT;
    },
    async session({ session, token }): Promise<ExtendedSession> {
      const extendedSession = session as ExtendedSession;
      if (extendedSession.user) {
        extendedSession.user.role = (token.role as string) ?? "";
        extendedSession.user.id = (token.id as string) ?? "";
      }
      return extendedSession;
    },
  },
  pages: {
    signIn: "/#login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Validate NEXTAUTH_SECRET at startup — insecure default is dangerous in production
if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32"
  );
}

/**
 * Typed wrapper for getServerSession to avoid repeating
 * `as ExtendedSession | null` across API routes.
 */
export async function getAuthSession(): Promise<ExtendedSession | null> {
  return getServerSession(authOptions) as Promise<ExtendedSession | null>;
}

export { hashPassword };
