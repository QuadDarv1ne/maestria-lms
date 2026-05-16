import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: Все курсы (включая неопубликованные) — для админов
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === "published") where.isPublished = true;
    if (status === "unpublished") where.isPublished = false;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          teacher: {
            select: { id: true, name: true, email: true, image: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: {
              enrollments: true,
              modules: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    return NextResponse.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Ошибка получения курсов (админ):", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST: Создать новый курс с модулями и уроками
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора или преподавателя" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      slug,
      description,
      shortDesc,
      price = 0,
      oldPrice,
      level = "beginner",
      duration,
      isPublished = false,
      isFeatured = false,
      hasCertificate = true,
      tags,
      requirements,
      whatYouLearn,
      categoryId,
      modules = [],
    } = body;

    // Валидация
    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Название должно быть не менее 3 символов" },
        { status: 400 }
      );
    }
    if (!slug || slug.length < 3) {
      return NextResponse.json(
        { error: "Slug обязателен (минимум 3 символа)" },
        { status: 400 }
      );
    }
    if (!description || description.length < 10) {
      return NextResponse.json(
        { error: "Описание должно быть не менее 10 символов" },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // Проверяем уникальность slug
    const existingCourse = await db.course.findUnique({
      where: { slug },
    });

    if (existingCourse) {
      return NextResponse.json(
        { error: "Курс с таким URL-идентификатором уже существует" },
        { status: 409 }
      );
    }

    // Ищем категорию по slug если передан slug, а не id
    let categoryConnect = categoryId || undefined;
    if (categoryId && !categoryId.startsWith("cl")) {
      // Это slug, а не id — найдём категорию
      const cat = await db.category.findUnique({ where: { slug: categoryId } });
      if (cat) categoryConnect = cat.id;
    }

    // Создаём курс с модулями и уроками
    const course = await db.course.create({
      data: {
        title,
        slug,
        description,
        shortDesc: shortDesc || null,
        price: Number(price) || 0,
        oldPrice: oldPrice ? Number(oldPrice) : null,
        level,
        duration: duration || null,
        isPublished,
        isFeatured,
        hasCertificate,
        tags: tags || null,
        requirements: requirements || null,
        whatYouLearn: whatYouLearn || null,
        categoryId: categoryConnect || null,
        teacherId: userId,
        modules: {
          create: modules.map((mod: any, mIdx: number) => ({
            title: mod.title || `Модуль ${mIdx + 1}`,
            description: mod.description || null,
            sortOrder: mod.sortOrder || mIdx + 1,
            lessons: {
              create: (mod.lessons || []).map((lesson: any, lIdx: number) => ({
                title: lesson.title || `Урок ${lIdx + 1}`,
                type: lesson.type || "text",
                content: lesson.content || null,
                videoUrl: lesson.videoUrl || null,
                duration: Number(lesson.duration) || 0,
                sortOrder: lesson.sortOrder || lIdx + 1,
                isFree: lesson.isFree || false,
              })),
            },
          })),
        },
      },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    return NextResponse.json(
      { message: isPublished ? "Курс опубликован" : "Курс сохранён как черновик", course },
      { status: 201 }
    );
  } catch (error) {
    console.error("Ошибка создания курса:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
