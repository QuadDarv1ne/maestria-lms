import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Список всех опубликованных курсов с фильтрами
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const level = searchParams.get("level");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const skip = (page - 1) * limit;

    // Строим условия фильтрации
    const where: any = {
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
        orderBy: [
          { isFeatured: "desc" },
          { createdAt: "desc" },
        ],
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
