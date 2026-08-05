import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { cacheInvalidateByTag } from "@/lib/cache";
import { getAuthSession, requireAuth, authErrorResponse, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { z } from "zod";
import { sanitizeContent } from "@/lib/sanitize";
import { validateParams } from "@/lib/request-validation";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("article", RATE_LIMITS.default);

const VIEW_DEDUP_COOKIE = "article_view";
const VIEW_DEDUP_TTL = 30; // seconds — prevent refresh-based inflation

const articleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  image: z.string().url().optional().nullable(),
  category: z.string().optional(),
  tags: z.string().optional().nullable(),
  readTime: z.number().int().min(1).max(120).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { slug } = await params;
    const paramCheck = validateParams({ slug }, z.object({ slug: z.string().min(1).max(200) }));
    if ("response" in paramCheck) return paramCheck.response;

    const article = await db.article.findUnique({
      where: { slug },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            bio: true,
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    if (!article.isPublished) {
      const session = await getAuthSession();
      if (!session?.user || (session.user.role !== "admin" && session.user.role !== "teacher")) {
        return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
      }
    }

    // Increment views only for published articles, with cookie-based dedup
    if (article.isPublished) {
      const viewCookie = request.cookies.get(VIEW_DEDUP_COOKIE);
      const lastView = viewCookie ? parseInt(viewCookie.value, 10) : 0;
      const now = Math.floor(Date.now() / 1000);

      if (now - lastView > VIEW_DEDUP_TTL) {
        try {
          await db.article.update({
            where: { id: article.id },
            data: { views: { increment: 1 } },
          });
        } catch (viewError: unknown) {
          // Don't fail the request if view counting fails
          log.warn("Failed to increment article views", {
            articleId: article.id,
            error: viewError instanceof Error ? viewError.message : String(viewError),
          });
        }
      }

      const response = NextResponse.json(article, { status: 200 });
      response.cookies.set(VIEW_DEDUP_COOKIE, String(now), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: VIEW_DEDUP_TTL,
        path: "/",
      });
      return response;
    }

    return NextResponse.json(article, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "article" });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    if (!["teacher", "admin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { slug } = await params;
    const paramCheck = validateParams({ slug }, z.object({ slug: z.string().min(1).max(200) }));
    if ("response" in paramCheck) return paramCheck.response;

    const article = await db.article.findUnique({ where: { slug } });

    if (!article) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    if (article.authorId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const validation = articleUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Ошибка валидации" }, { status: 400 });
    }

    const updateData = { ...validation.data };
    if (updateData.content) {
      updateData.content = sanitizeContent(updateData.content);
    }
    if (updateData.excerpt) {
      updateData.excerpt = sanitizeContent(updateData.excerpt);
    }

    // Check slug uniqueness if being changed
    if (updateData.slug && updateData.slug !== article.slug) {
      const existing = await db.article.findUnique({ where: { slug: updateData.slug } });
      if (existing) {
        return NextResponse.json(
          { error: "Статья с таким slug уже существует" },
          { status: 409 }
        );
      }
    }

    const updated = await db.article.update({
      where: { id: article.id },
      data: updateData,
    });

    // Invalidate article list caches (title/excerpt/tags may have changed)
    await cacheInvalidateByTag("articles");
    await cacheInvalidateByTag("blog");

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "article" });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    if (!requireAdmin(session)) return adminErrorResponse();

    const { slug } = await params;
    const paramCheck = validateParams({ slug }, z.object({ slug: z.string().min(1).max(200) }));
    if ("response" in paramCheck) return paramCheck.response;

    await db.article.delete({ where: { slug } });

    // Invalidate article list caches
    await cacheInvalidateByTag("articles");
    await cacheInvalidateByTag("blog");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "article" });
  }
}
