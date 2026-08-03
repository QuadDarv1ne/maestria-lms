import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requireAuth, authErrorResponse, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const checkRateLimit = rateLimit("admin-activity", RATE_LIMITS.admin);

/**
 * GET /api/admin/activity
 *
 * Returns recent platform activity for the admin dashboard.
 * Includes: new enrollments, completed payments, new reviews, new users.
 * Only accessible by admin users.
 */
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const session = await getAuthSession();
  if (!requireAuth(session)) return authErrorResponse();
  if (!requireAdmin(session)) return adminErrorResponse();

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100);

  try {
    const [recentEnrollments, recentPayments, recentReviews, recentUsers] = await Promise.all([
      // Recent enrollments
      db.enrollment.findMany({
        orderBy: { enrolledAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          course: { select: { id: true, title: true, slug: true } },
        },
      }),

      // Recent payments
      db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        where: { status: { not: "pending" } },
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } },
        },
      }),

      // Recent reviews
      db.review.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, name: true, image: true } },
          course: { select: { id: true, title: true } },
        },
      }),

      // Recent user registrations
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
      }),
    ]);

    // Build a unified activity feed sorted by timestamp
    const activities: Array<{
      type: "enrollment" | "payment" | "review" | "registration";
      timestamp: string;
      user: { id: string; name: string | null; email: string; image?: string | null };
      details: Record<string, unknown>;
    }> = [];

    for (const e of recentEnrollments) {
      activities.push({
        type: "enrollment",
        timestamp: e.enrolledAt.toISOString(),
        user: { id: e.user.id, name: e.user.name, email: e.user.email, image: e.user.image },
        details: { courseId: e.course.id, courseTitle: e.course.title, courseSlug: e.course.slug, status: e.status },
      });
    }

    for (const p of recentPayments) {
      activities.push({
        type: "payment",
        timestamp: p.createdAt.toISOString(),
        user: { id: p.user.id, name: p.user.name, email: p.user.email },
        details: { paymentId: p.id, amount: p.amount, currency: p.currency, status: p.status, courseTitle: p.course.title },
      });
    }

    for (const r of recentReviews) {
      activities.push({
        type: "review",
        timestamp: r.createdAt.toISOString(),
        user: { id: r.user.id, name: r.user.name, email: "", image: r.user.image },
        details: { reviewId: r.id, rating: r.rating, courseTitle: r.course.title },
      });
    }

    for (const u of recentUsers) {
      activities.push({
        type: "registration",
        timestamp: u.createdAt.toISOString(),
        user: { id: u.id, name: u.name, email: u.email, image: u.image },
        details: { role: u.role },
      });
    }

    // Sort by timestamp descending and limit
    activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const feed = activities.slice(0, limit);

    return NextResponse.json({
        data: {
          activities: feed,
          total: feed.length,
        },
      });
  } catch (error: unknown) {
    log.error("Failed to fetch admin activity", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch activity data", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}