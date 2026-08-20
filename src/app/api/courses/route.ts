import { NextRequest, NextResponse } from "next/server";
import { db, Prisma, getDatabaseProvider } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { cacheGet, cacheSet, generateCacheKey, createCacheHeaders } from "@/lib/cache";
import { validateSearchParams } from "@/lib/api-validation";
import { coursesListQuerySchema } from "./_validation";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("courses", RATE_LIMITS.default);

// GET: Список всех опубликованных курсов с фильтрами
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const validated = validateSearchParams(searchParams, coursesListQuerySchema);
    if (validated instanceof NextResponse) return validated;
    const { ids } = validated;

    // Batch fetch by IDs - lightweight response for bookmark/title fetching
    if (ids) {
      const idList = ids.split(",").filter(Boolean);
      const courses = await db.course.findMany({
        where: { id: { in: idList }, isPublished: true },
        select: { id: true, title: true, slug: true },
      });
      return NextResponse.json({ courses }, { status: 200 });
    }

    // Generate cache key from query params
    const cacheKey = generateCacheKey("courses:list", {
      category: searchParams.get("category"),
      search: searchParams.get("search"),
      level: searchParams.get("level"),
      freeOnly: searchParams.get("freeOnly"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sortBy: searchParams.get("sortBy"),
    });

    // Define response type for cache
    type CoursesResponse = {
      courses: unknown[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };

    // Try to get from cache
    const cached = await cacheGet<CoursesResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          ...createCacheHeaders(300, true, 600),
          "X-Cache": "HIT",
        },
      });
    }

    const { category, search, level, freeOnly, sortBy: sortByParam } = validated;
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 12, maxLimit: 100 });
    const sortBy = sortByParam || "new";

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

    if (freeOnly === "true") {
      where.price = 0;
    }

    if (search) {
      // Use case-insensitive search for PostgreSQL; SQLite/MongoDB handle this natively
      const provider = getDatabaseProvider();
      const searchFilter = provider === "postgresql"
        ? { contains: search, mode: "insensitive" as const }
        : { contains: search };
      where.OR = [
        { title: searchFilter },
        { description: searchFilter },
        { shortDesc: searchFilter },
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
        createdAt: course.createdAt,
      };
    });

    const responseData = {
      courses: coursesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the response for 5 minutes
    await cacheSet(cacheKey, responseData, {
      ttl: 5 * 60 * 1000,
      tags: ["courses", "catalog"],
    });

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        ...createCacheHeaders(300, true, 600),
        "X-Cache": "MISS",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses" });
  }
}
