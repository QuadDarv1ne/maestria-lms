import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("achievements", RATE_LIMITS.default);

// GET: Supplementary data for achievements calculation
export const revalidate = 120;

export async function GET(request: Request) {
  try {
    const blocked = checkRateLimit(request);
    if (blocked) return blocked;

    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const [completedCodingAssignments, completedLessonsCount, totalUsers, user] = await Promise.all([
      db.progress.count({
        where: {
          userId,
          completed: true,
          lesson: {
            type: { in: ["coding", "assignment"] },
          },
        },
      }),
      db.progress.count({
        where: {
          userId,
          completed: true,
        },
      }),
      db.user.count(),
      db.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      }),
    ]);

    const usersBefore = user
      ? await db.user.count({
          where: {
            createdAt: { lt: user.createdAt },
          },
        })
      : totalUsers;

    return NextResponse.json(
      {
        completedCodingAssignments,
        completedLessonsCount,
        totalUsers,
        userRegistrationOrder: usersBefore + 1,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "achievements" });
  }
}
