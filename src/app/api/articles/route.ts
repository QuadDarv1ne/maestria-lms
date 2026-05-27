import { NextRequest, NextResponse } from "next/server";
import { db, Prisma } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sanitizeContent } from "@/lib/sanitize";
import { cacheGet, cacheSet, cacheInvalidateByTag, generateCacheKey, createCacheHeaders } from "@/lib/cache";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("articles", RATE_LIMITS.default);

export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const featured = searchParams.get("featured");
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 12, maxLimit: 100 });
    const sortBy = searchParams.get("sortBy") || "new";

    // Generate cache key
    const cacheKey = generateCacheKey("articles:list", {
      category,
      search,
      tag,
      featured,
      page,
      limit,
      sortBy,
    });

    // Try cache
    const cached = await cacheGet<typeof cachedResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          ...createCacheHeaders(300, true, 600),
          "X-Cache": "HIT",
        },
      });
    }

    const where: Prisma.ArticleWhereInput = {
      isPublished: true,
    };

    if (category && category !== "all") {
      where.category = category;
    }

    if (featured === "true") {
      where.isFeatured = true;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
        { content: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    const orderByMap: Record<string, Prisma.ArticleOrderByWithRelationInput> = {
      new: { createdAt: Prisma.SortOrder.desc },
      popular: { views: Prisma.SortOrder.desc },
      featured: { isFeatured: Prisma.SortOrder.desc },
    };

    const orderBy: Prisma.ArticleOrderByWithRelationInput[] = [
      { isFeatured: Prisma.SortOrder.desc },
      ...(sortBy && orderByMap[sortBy] ? [orderByMap[sortBy]] : [{ createdAt: Prisma.SortOrder.desc }]),
    ];

    const [articles, total] = await Promise.all([
      db.article.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.article.count({ where }),
    ]);

    const responseData = {
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, responseData, {
      ttl: 5 * 60 * 1000,
      tags: ["articles", "blog"],
    });

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        ...createCacheHeaders(300, true, 600),
        "X-Cache": "MISS",
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "articles" });
  }
}

export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["teacher", "admin"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, slug, content, excerpt, image, category, tags, readTime, isPublished, isFeatured } = body;

    if (!title || !slug || !content || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const article = await db.article.create({
      data: {
        title: title.trim(),
        slug,
        content: sanitizeContent(content),
        excerpt: excerpt ? sanitizeContent(excerpt) : null,
        image,
        category,
        tags,
        readTime: readTime || 5,
        isPublished: isPublished || false,
        isFeatured: isFeatured || false,
        authorId: user.id,
      },
    });

    // Invalidate article caches
    await cacheInvalidateByTag("articles");
    await cacheInvalidateByTag("blog");

    return NextResponse.json(article, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "articles" });
  }
}
