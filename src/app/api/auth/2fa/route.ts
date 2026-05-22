import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";
import { authenticator } from "otplib";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("twoFactor", RATE_LIMITS.twoFactor);

const enable2FASchema = z.object({
  password: z.string().min(1, "Введите текущий пароль"),
});

const verify2FASchema = z.object({
  code: z.string().length(6, "Код должен содержать 6 цифр"),
});

const disable2FASchema = z.object({
  password: z.string().min(1, "Введите текущий пароль"),
  code: z.string().length(6, "Код должен содержать 6 цифр"),
});

// Криптографически безопасная генерация секрета для 2FA
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomValues = new Uint32Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    secret += chars[randomValues[i] % chars.length];
  }
  return secret;
}

// Генерация данных QR-кода (otpauth URL)
function generateOtpAuthUrl(secret: string, email: string): string {
  const issuer = encodeURIComponent('Maestria');
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// POST: Включить 2FA — генерирует секрет и возвращает данные QR-кода
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const validation = enable2FASchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA уже включена" }, { status: 400 });
    }

    // Генерируем секрет
    const secret = generateSecret();
    const otpauthUrl = generateOtpAuthUrl(secret, user.email || '');

    // Временно сохраняем секрет (подтверждение после проверки кода)
    await db.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return NextResponse.json({
      message: "Отсканируйте QR-код в приложении-аутентификаторе и введите код для подтверждения",
      otpauthUrl,
    }, { status: 200 });
  } catch (error) {
    console.error("Ошибка включения 2FA:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// PUT: Подтвердить настройку 2FA
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const validation = verify2FASchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { code } = validation.data;
    const userId = session.user.id;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: "Сначала включите 2FA" }, { status: 400 });
    }

    // Проверяем TOTP-код с помощью otplib, используя секрет из БД
    let isValid = false;
    try {
      isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    } catch {
      // Невалидный формат токена
    }
    if (!isValid) {
      return NextResponse.json({ error: "Неверный код подтверждения" }, { status: 400 });
    }

    // Активируем 2FA
    await db.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({ message: "Двухфакторная аутентификация успешно включена" }, { status: 200 });
  } catch (error) {
    console.error("Ошибка подтверждения 2FA:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

// DELETE: Отключить 2FA
export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const validation = disable2FASchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA не включена" }, { status: 400 });
    }

    // Verify the current 2FA code to ensure the user has access to their authenticator device
    const { code } = validation.data;
    let isValid = false;
    try {
      isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret ?? "" });
    } catch {
      // Invalid token format
    }
    if (!isValid) {
      return NextResponse.json({ error: "Неверный код подтверждения" }, { status: 400 });
    }

    // Отключаем 2FA и удаляем секрет
    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return NextResponse.json({ message: "Двухфакторная аутентификация отключена" }, { status: 200 });
  } catch (error) {
    console.error("Ошибка отключения 2FA:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
