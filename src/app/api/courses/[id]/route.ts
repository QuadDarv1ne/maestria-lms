import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { cacheGet, cacheSet, generateCacheKey, createCacheHeaders } from "@/lib/cache";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("courseDetail", RATE_LIMITS.default);

// GET: Детальная информация о курсе
export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id } = await params;

    // Check if user is authenticated - cache only for anonymous users
    const session = await getAuthSession();

    // For anonymous users, try to get from cache
    if (!session?.user?.id) {
      const cacheKey = generateCacheKey("course:detail", { id });
      const cached = await cacheGet<CourseDetailResponse>(cacheKey);

      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: {
            ...createCacheHeaders(300, true, 600),
            "X-Cache": "HIT",
          },
        });
      }
    }

    // Try to find by id first, then by slug
    const course = await db.course.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            image: true,
            bio: true,
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
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                title: true,
                type: true,
                duration: true,
                sortOrder: true,
                isFree: true,
              },
            },
          },
        },
        reviews: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
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
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    // Проверяем доступ к неопубликованным курсам
    if (!course.isPublished) {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Курс недоступен" },
          { status: 403 }
        );
      }
      const userRole = session.user.role;
      const isEnrolled = await db.enrollment.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      });
      const isOwner = course.teacherId === session.user.id;
      if (userRole !== "admin" && userRole !== "teacher" && !isEnrolled && !isOwner) {
        return NextResponse.json(
          { error: "Курс недоступен" },
          { status: 403 }
        );
      }
    }

    // Проверяем, авторизован ли пользователь и записан ли он на курс
    // Use resolved course.id (not raw param which could be a slug)
    let userEnrollment = null;
    type LessonProgress = { lessonId: string; completed: boolean };
    let userProgress: LessonProgress[] = [];

    if (session?.user?.id) {
      userEnrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: course.id,
          },
        },
      });

      // Если пользователь записан, получаем прогресс по урокам
      if (userEnrollment) {
        const lessonIds = course.modules.flatMap((m) =>
          m.lessons.map((l) => l.id)
        );
        userProgress = await db.progress.findMany({
          where: {
            userId: session.user.id,
            lessonId: { in: lessonIds },
          },
          select: { lessonId: true, completed: true },
        });
      }
    }

    // Вычисляем статистику
    const totalLessons = course.modules.reduce(
      (acc, module) => acc + module.lessons.length,
      0
    );
    const totalDuration = course.modules.reduce(
      (acc, module) =>
        acc + module.lessons.reduce((a, l) => a + l.duration, 0),
      0
    );
    const freeLessons = course.modules.reduce(
      (acc, module) => acc + module.lessons.filter((l) => l.isFree).length,
      0
    );

    // Формируем данные для отзывов
    const reviewsWithUser = course.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: review.user,
    }));

    // Быстрый lookup прогресса по lessonId
    const progressMap = new Map(userProgress.map((p) => [p.lessonId, p.completed]));

    // Добавляем прогресс к урокам для записанных пользователей
    const modulesWithProgress = course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        completed: progressMap.get(lesson.id) || false,
      })),
    }));

    const responseData = {
      course: {
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
        isPublished: course.isPublished,
        isFeatured: course.isFeatured,
        hasCertificate: course.hasCertificate,
        rating: course.rating,
        reviewCount: course._count.reviews,
        studentCount: course._count.enrollments,
        tags: course.tags,
        requirements: course.requirements,
        whatYouLearn: course.whatYouLearn,
        teacher: course.teacher,
        category: course.category,
        modules: modulesWithProgress,
        reviews: reviewsWithUser,
        totalLessons,
        totalDuration,
        freeLessons,
        isEnrolled: !!userEnrollment,
        enrollmentStatus: userEnrollment?.status || null,
        enrollmentProgress: userEnrollment?.progress || 0,
      },
    };

    // Cache for anonymous users
    if (!session?.user?.id) {
      const cacheKey = generateCacheKey("course:detail", { id });
      await cacheSet(cacheKey, responseData, {
        ttl: 5 * 60 * 1000, // 5 minutes
        tags: ["course", `course:${course.id}`, `course:${course.slug}`],
      });

      return NextResponse.json(responseData, {
        status: 200,
        headers: {
          ...createCacheHeaders(300, true, 600),
          "X-Cache": "MISS",
        },
      });
    }

    // For authenticated users, return without long-term caching
    return NextResponse.json(responseData, {
      status: 200,
      headers: createCacheHeaders(60, false),
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "courses/[id]" });
  }
}

// Define the cached response type
type CourseDetailResponse = {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    shortDesc: string | null;
    image: string | null;
    price: number;
    oldPrice: number | null;
    currency: string;
    level: string;
    duration: string | null;
    language: string;
    isPublished: boolean;
    isFeatured: boolean;
    hasCertificate: boolean;
    rating: number;
    reviewCount: number;
    studentCount: number;
    tags: string[];
    requirements: string[] | null;
    whatYouLearn: string[] | null;
    teacher: {
      id: string;
      name: string | null;
      image: string | null;
      bio: string | null;
    };
    category: {
      id: string;
      name: string;
      slug: string;
      icon: string | null;
      color: string | null;
    };
    modules: Array<{
      id: string;
      title: string;
      description: string | null;
      sortOrder: number;
      lessons: Array<{
        id: string;
        title: string;
        type: string;
        duration: number | null;
        sortOrder: number;
        isFree: boolean;
        completed: boolean;
      }>;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      user: {
        id: string;
        name: string | null;
        image: string | null;
      };
    }>;
    totalLessons: number;
    totalDuration: number;
    freeLessons: number;
    isEnrolled: boolean;
    enrollmentStatus: string | null;
    enrollmentProgress: number;
  };
};
