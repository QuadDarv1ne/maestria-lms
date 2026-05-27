import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { rateLimitAsync, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // Rate limiting: max 30 requests per minute
    const { response: rateLimitResponse } = await rateLimitAsync("metrics", request, {
      windowMs: RATE_LIMITS.default.windowMs,
      maxRequests: RATE_LIMITS.default.maxRequests,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Require admin authentication
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) {
      return adminError;
    }

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
  } catch (error: unknown) {
    return handleApiError(error, { route: "metrics" });
  }
}
