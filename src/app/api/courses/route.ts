import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const checkRateLimit = rateLimit("courses", RATE_LIMITS.default);

// GET: Список всех опубликованных курсов с фильтрами
export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
    const sortBy = searchParams.get("sortBy") || "new";
    const skip = (page - 1) * limit;

    // Строим условия фильтрации
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
    };

    if (category) {
      // Поиск по slug категории
      const categoryRecord = await db.category.findUnique({
        where: { slug: category },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    if (level) {
      where.level = level;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { shortDesc: { contains: search } },
      ];
    }

    // Сортировка
    const orderByMap: Record<string, Prisma.CourseOrderByWithRelationInput> = {
      popular: { studentCount: Prisma.SortOrder.desc },
      new: { createdAt: Prisma.SortOrder.desc },
      rating: { rating: Prisma.SortOrder.desc },
      priceAsc: { price: Prisma.SortOrder.asc },
      priceDesc: { price: Prisma.SortOrder.desc },
    };
    const orderBy: Prisma.CourseOrderByWithRelationInput[] = [
      { isFeatured: Prisma.SortOrder.desc },
      ...(sortBy && orderByMap[sortBy] ? [orderByMap[sortBy]] : [{ createdAt: Prisma.SortOrder.desc }]),
    ];

    // Получаем курсы с дополнительной информацией
    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              color: true,
            },
          },
          modules: {
            select: {
              id: true,
              lessons: {
                select: {
                  id: true,
                  duration: true,
                },
              },
            },
          },
          _count: {
            select: {
              enrollments: true,
              reviews: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    // Вычисляем дополнительные данные для каждого курса
    const coursesWithStats = courses.map((course) => {
      const totalLessons = course.modules.reduce(
        (acc, module) => acc + module.lessons.length,
        0
      );
      const totalDuration = course.modules.reduce(
        (acc, module) =>
          acc + module.lessons.reduce((a, l) => a + l.duration, 0),
        0
      );

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        shortDesc: course.shortDesc,
        image: course.image,
        price: course.price,
        oldPrice: course.oldPrice,
        currency: course.currency,
        level: course.level,
        duration: course.duration,
        language: course.language,
        isFeatured: course.isFeatured,
        hasCertificate: course.hasCertificate,
        rating: course.rating,
        reviewCount: course._count.reviews,
        studentCount: course._count.enrollments,
        tags: course.tags,
        teacher: course.teacher,
        category: course.category,
        totalLessons,
        totalDuration,
        modulesCount: course.modules.length,
      };
    });

    return NextResponse.json({
      courses: coursesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Ошибка получения курсов:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
