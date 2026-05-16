import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

// Простая функция хеширования с использованием Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'maestro7it-salt-2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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

        const passwordHash = await hashPassword(credentials.password);
        if (passwordHash !== user.passwordHash) {
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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/#login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export { hashPassword };
