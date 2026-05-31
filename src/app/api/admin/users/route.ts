import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession, requireAdmin, type ExtendedSession } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  userId: z.string().min(1, "ID пользователя обязателен"),
  role: z.enum(["student", "teacher", "admin"]).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(50).optional(),
});

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

// GET: Все пользователи с пагинацией
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const search = searchParams.get("search");
    const role = searchParams.get("role");

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          _count: {
            select: {
              enrollments: true,
              teacherCourses: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/users GET" });
  }
}

// PUT: Обновить пользователя (роль, статус)
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const authenticatedSession = session as ExtendedSession;

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { userId, ...updateData } = validation.data;

    // Проверяем, не пытается ли админ заблокировать сам себя
    if (userId === authenticatedSession.user.id && updateData.isActive === false) {
      return NextResponse.json(
        { error: "Нельзя заблокировать самого себя" },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        image: true,
      },
    });

    return NextResponse.json(
      { message: "Пользователь обновлён", user: updatedUser },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/users PUT" });
  }
}
