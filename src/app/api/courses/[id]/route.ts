import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ExtendedSession } from "@/lib/auth";

// GET: Детальная информация о курсе
export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
        enrollments: {
          select: {
            id: true,
            userId: true,
            status: true,
            progress: true,
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
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
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
    let userEnrollment = null;
    type LessonProgress = { lessonId: string; completed: boolean };
    let userProgress: LessonProgress[] = [];

    if (session?.user?.id) {
      userEnrollment = await db.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: session.user.id,
            courseId: id,
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

    return NextResponse.json({
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
    }, { status: 200 });
  } catch (error) {
    console.error("Ошибка получения курса:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
