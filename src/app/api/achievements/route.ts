import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

// GET: Supplementary data for achievements calculation
export const revalidate = 120;

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Count completed coding/assignment lessons from Progress
    const completedCodingLessons = await db.progress.findMany({
      where: {
        userId,
        completed: true,
        lesson: {
          type: { in: ["coding", "assignment"] },
        },
      },
      select: {
        id: true,
        lessonId: true,
      },
    });

    // Count total completed lessons
    const completedLessonsCount = await db.progress.count({
      where: {
        userId,
        completed: true,
      },
    });

    // Count total users for "early adopter" check
    const totalUsers = await db.user.count();

    // Get user's registration order
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    // Count users registered before this user
    const usersBefore = user
      ? await db.user.count({
          where: {
            createdAt: { lt: user.createdAt },
          },
        })
      : totalUsers;

    return NextResponse.json(
      {
        completedCodingAssignments: completedCodingLessons.length,
        completedLessonsCount,
        totalUsers,
        userRegistrationOrder: usersBefore + 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Ошибка получения данных достижений:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
