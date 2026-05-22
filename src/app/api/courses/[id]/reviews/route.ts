import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";

const checkPostRateLimit = rateLimit("review", RATE_LIMITS.review);
const checkGetRateLimit = rateLimit("reviewGet", RATE_LIMITS.default);

// GET: Get paginated reviews for a course
export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkGetRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId } = await params;

    // Check if course exists
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    // Fetch reviews and total count in parallel
    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where: { courseId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      }),
      db.review.count({
        where: { courseId },
      }),
    ]);

    return NextResponse.json(
      {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка получения отзывов:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

// POST: Submit a new review or update an existing one
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = checkPostRateLimit(request);
  if (blocked) return blocked;
  try {
    const { id: courseId } = await params;

    // Check authentication
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Оценка должна быть числом от 1 до 5" },
        { status: 400 }
      );
    }

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== "string") {
        return NextResponse.json(
          { error: "Комментарий должен быть строкой" },
          { status: 400 }
        );
      }
      if (comment.trim().length > 500) {
        return NextResponse.json(
          { error: "Комментарий не должен превышать 500 символов" },
          { status: 400 }
        );
      }
    }

    // Check if course exists
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, rating: true, reviewCount: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    // Check if user is enrolled in the course
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status === "cancelled") {
      return NextResponse.json(
        { error: "Вы не записаны на этот курс" },
        { status: 403 }
      );
    }

    // Wrap review creation/update AND rating recalculation in a single transaction
    // to prevent race conditions when multiple requests arrive concurrently.
    const result = await db.$transaction(async (tx) => {
      // Check for existing review INSIDE the transaction to prevent race conditions
      const existing = await tx.review.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });

      let r;

      if (existing) {
        // Update existing review
        r = await tx.review.update({
          where: { id: existing.id },
          data: {
            rating,
            comment: comment?.trim() || null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
      } else {
        // Create new review
        r = await tx.review.create({
          data: {
            userId,
            courseId,
            rating,
            comment: comment?.trim() || null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        });
      }

      // Recalculate course rating average and review count (inside transaction)
      const stats = await tx.review.aggregate({
        where: { courseId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.course.update({
        where: { id: courseId },
        data: {
          rating: stats._avg.rating ?? 0,
          reviewCount: stats._count.rating,
        },
      });

      return { review: r, wasUpdated: !!existing };
    });

    // Send notification for new review (not for updates)
    if (!result.wasUpdated) {
      const courseData = await db.course.findUnique({
        where: { id: courseId },
        select: { title: true, teacherId: true },
      });
      if (courseData?.teacherId) {
        createNotification({
          userId: courseData.teacherId,
          type: "review",
          title: "Новый отзыв",
          message: `Студент оставил отзыв на курс "${courseData.title}"`,
          link: `course/${courseId}`,
        }).catch(() => {});
      }
    }

    return NextResponse.json(
      {
        review: result.review,
        updated: result.wasUpdated,
      },
      { status: result.wasUpdated ? 200 : 201 }
    );
  } catch (error) {
    console.error("Ошибка создания отзыва:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
