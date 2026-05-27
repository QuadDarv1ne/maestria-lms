import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [
      userCount,
      courseCount,
      enrollmentCount,
      paymentCount,
      reviewCount,
      articleCount,
      notificationCount,
    ] = await Promise.all([
      db.user.count(),
      db.course.count({ where: { isPublished: true } }),
      db.enrollment.count({ where: { status: "active" } }),
      db.payment.count({ where: { status: "completed" } }),
      db.review.count(),
      db.article.count({ where: { isPublished: true } }),
      db.notification.count({ where: { read: false } }),
    ]);

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return NextResponse.json({
      system: {
        uptime: `${Math.floor(uptime / 60)}m`,
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        },
      },
      data: {
        users: userCount,
        courses: courseCount,
        activeEnrollments: enrollmentCount,
        completedPayments: paymentCount,
        reviews: reviewCount,
        publishedArticles: articleCount,
        unreadNotifications: notificationCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, { route: "metrics" });
  }
}
