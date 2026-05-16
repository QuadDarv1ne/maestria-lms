import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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

interface ExtendedSession extends Session {
  user: {
    id?: string;
    role?: string;
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

        if (!user || !user.passwordHash) {
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

        if (!user.isActive) {
          throw new Error("Аккаунт заблокирован");
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
      if (session.user) {
        (session.user as ExtendedSession["user"]).role = token.role as string | undefined;
        (session.user as ExtendedSession["user"]).id = token.id as string | undefined;
      }
      return session as ExtendedSession;
    },
  },
  pages: {
    signIn: "/#login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export { hashPassword };
