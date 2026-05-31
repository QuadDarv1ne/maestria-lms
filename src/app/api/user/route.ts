import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession, requireAuth, type ExtendedSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("profile", RATE_LIMITS.profile);
const checkProfileGetRateLimit = rateLimit("profileGet", RATE_LIMITS.profile);

const updateProfileSchema = z.object({
  name: z.string().min(2, "Имя должно быть не менее 2 символов").max(50).optional(),
  bio: z.string().max(500, "Биография слишком длинная").optional(),
  phone: z.string().max(20).optional(),
  image: z.string().url("Неверный URL изображения").optional().or(z.literal("")),
});

// GET: Профиль текущего пользователя
export async function GET(request: NextRequest) {
  const blocked = checkProfileGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const authError = requireAuth(session);
    if (authError) return authError;

    const authSession = session as ExtendedSession;
    const userId = authSession.user.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        bio: true,
        phone: true,
        twoFactorEnabled: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            reviews: true,
            certificates: true,
            teacherCourses: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Параллельные запросы: записи на курсы, прогресс, сертификаты
    const [enrollments, progress, certificates] = await Promise.all([
      db.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              image: true,
              level: true,
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      }),
      db.progress.findMany({
        where: { userId },
        select: {
          lessonId: true,
          completed: true,
          timeSpent: true,
          score: true,
          lastAccessed: true,
        },
        take: 1000,
        orderBy: { lastAccessed: "desc" },
      }),
      db.certificate.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      user,
      enrollments,
      certificates,
      progress,
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "profile GET" });
  }
}

// PUT: Обновить профиль
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const authError = requireAuth(session);
    if (authError) return authError;

    const authSession = session as ExtendedSession;
    const userId = authSession.user.id;

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.bio !== undefined) updateData.bio = validation.data.bio;
    if (validation.data.phone !== undefined) updateData.phone = validation.data.phone;
    if (validation.data.image !== undefined) updateData.image = validation.data.image || null;

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        bio: true,
        phone: true,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json(
      { message: "Профиль обновлён", user: updatedUser },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "profile PUT" });
  }
}
