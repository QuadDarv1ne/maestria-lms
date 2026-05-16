import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Имя должно быть не менее 2 символов").max(50).optional(),
  bio: z.string().max(500, "Биография слишком длинная").optional(),
  phone: z.string().max(20).optional(),
  image: z.string().url("Неверный URL изображения").optional().or(z.literal("")),
});

// GET: Профиль текущего пользователя
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

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

    // Получаем записи на курсы
    const enrollments = await db.enrollment.findMany({
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
    });

    // Получаем последние сертификаты
    const certificates = await db.certificate.findMany({
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
      take: 5,
    });

    return NextResponse.json({
      user,
      enrollments,
      certificates,
    }, { status: 200 });
  } catch (error) {
    console.error("Ошибка получения профиля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// PUT: Обновить профиль
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const updateData: any = {};
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
  } catch (error) {
    console.error("Ошибка обновления профиля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
