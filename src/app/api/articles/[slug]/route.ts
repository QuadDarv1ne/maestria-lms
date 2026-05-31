import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { getAuthSession, requireAuth, type ExtendedSession } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("article", RATE_LIMITS.default);

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
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (!article.isPublished) {
      const session = await getAuthSession();
      if (!session?.user) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
    }

    // Increment views (atomic to prevent race conditions)
    await db.article.update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    });

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
    const authError = requireAuth(session);
    if (authError) return authError;
    const authSession = session as ExtendedSession;

    if (!["teacher", "admin"].includes(authSession.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;
    const article = await db.article.findUnique({ where: { slug } });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (article.authorId !== authSession.user.id && authSession.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = articleUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const updated = await db.article.update({
      where: { id: article.id },
      data: validation.data,
    });

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
    const authError = requireAuth(session);
    if (authError) return authError;
    const authSession = session as ExtendedSession;

    if (authSession.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;

    await db.article.delete({ where: { slug } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "article" });
  }
}
