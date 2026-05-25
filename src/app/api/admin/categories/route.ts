import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const categorySchema = z.object({
  name: z.string().min(2, "Название должно быть от 2 до 100 символов").max(100),
  slug: z.string().min(2, "Slug должен быть от 2 до 100 символов").max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sortOrder: z.number().optional().default(0),
});

// GET: Get all categories
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });

    return NextResponse.json(
      { categories },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/categories GET" });
  }
}

// POST: Create a new category
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = categorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { name, slug, description, icon, color, sortOrder } = validation.data;

    // Проверяем уникальность
    const existing = await db.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Категория с таким названием или URL-идентификатором уже существует" },
        { status: 409 }
      );
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || null,
        sortOrder,
      },
    });

    return NextResponse.json(
      { message: "Категория создана", category },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/categories POST" });
  }
}

// PUT: Update a category
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");

    if (!categoryId) {
      return NextResponse.json(
        { error: "ID категории обязателен" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = categorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { name, slug, description, icon, color, sortOrder } = validation.data;

    // Проверяем что категория существует
    const existing = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Категория не найдена" },
        { status: 404 }
      );
    }

    // Проверяем уникальность если slug/name изменились
    if (slug !== existing.slug || name !== existing.name) {
      const duplicate = await db.category.findFirst({
        where: {
          id: { not: categoryId },
          OR: [{ name }, { slug }],
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Категория с таким названием или URL-идентификатором уже существует" },
          { status: 409 }
        );
      }
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || null,
        sortOrder,
      },
    });

    return NextResponse.json(
      { message: "Категория обновлена", category },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/categories PUT" });
  }
}

// DELETE: Delete a category
export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");

    if (!categoryId) {
      return NextResponse.json(
        { error: "ID категории обязателен" },
        { status: 400 }
      );
    }

    const existing = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            courses: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Категория не найдена" },
        { status: 404 }
      );
    }

    if (existing._count.courses > 0) {
      return NextResponse.json(
        { error: "Невозможно удалить категорию с существующими курсами" },
        { status: 400 }
      );
    }

    await db.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json(
      { message: "Категория удалена" },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/categories DELETE" });
  }
}
