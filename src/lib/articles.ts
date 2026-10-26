import { cache } from "react";
import { db, Prisma, getDatabaseProvider } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Shared article query layer.
 *
 * Server components and route handlers both read articles through this module
 * so the `select` shapes and the cache/dedup behaviour stay in one place.
 * `cache()` from React deduplicates calls made during a single render pass
 * (e.g. `generateMetadata` and the page component asking for the same slug).
 */

export interface ArticleAuthor {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  bio: string | null;
}

export interface FullArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image: string | null;
  category: string;
  tags: string | null;
  readTime: number;
  views: number;
  isPublished: boolean;
  isFeatured: boolean;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: ArticleAuthor;
}

export interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image: string | null;
  category: string;
  readTime: number;
  views: number;
  createdAt: Date;
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  image: true,
  category: true,
  tags: true,
  readTime: true,
  views: true,
  isPublished: true,
  isFeatured: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      bio: true,
    },
  },
} as const;

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image: string | null;
  category: string;
  tags: string | null;
  readTime: number;
  views: number;
  isFeatured: boolean;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null; role: string };
}

export interface ArticlesPageOptions {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  sortBy?: "new" | "popular";
}

export interface ArticlesPageResult {
  articles: ArticleListItem[];
  total: number;
  totalPages: number;
}

const ARTICLE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  image: true,
  category: true,
  tags: true,
  readTime: true,
  views: true,
  isFeatured: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, image: true, role: true },
  },
} as const;

/**
 * Paginated, filtered list of published articles for the blog page.
 * Returns empty results (never throws) when the database is unavailable —
 * the client renders its own error state.
 */
export async function getArticlesPage({
  page,
  limit,
  category,
  search,
  sortBy = "new",
}: ArticlesPageOptions): Promise<ArticlesPageResult> {
  const where: Prisma.ArticleWhereInput = { isPublished: true };

  if (category && category !== "all") {
    where.category = category;
  }

  if (search) {
    // 'mode: insensitive' is only supported by PostgreSQL; SQLite LIKE is case-insensitive natively
    const provider = getDatabaseProvider();
    const searchFilter = provider === "postgresql"
      ? { contains: search, mode: "insensitive" as const }
      : { contains: search };
    where.OR = [{ title: searchFilter }, { excerpt: searchFilter }];
  }

  const orderBy: { isFeatured?: "desc"; createdAt?: "desc"; views?: "desc" }[] = [
    { isFeatured: "desc" },
  ];
  if (sortBy === "popular") {
    orderBy.push({ views: "desc" });
  } else {
    orderBy.push({ createdAt: "desc" });
  }

  const skip = (page - 1) * limit;

  try {
    const [articles, total] = await Promise.all([
      db.article.findMany({ where, select: ARTICLE_LIST_SELECT, orderBy, skip, take: limit }),
      db.article.count({ where }),
    ]);

    return {
      articles: articles as ArticleListItem[],
      total,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    log.error("[articles] Failed to fetch article list", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { articles: [], total: 0, totalPages: 0 };
  }
}

/**
 * Fetch a single article by slug. Returns `null` when the article is missing
 * or the database is unavailable (callers decide between 404 and 503).
 */
export const getArticleBySlug = cache(async (slug: string): Promise<FullArticle | null> => {
  try {
    const article = await db.article.findUnique({
      where: { slug },
      select: ARTICLE_SELECT,
    });
    return article as FullArticle | null;
  } catch (error) {
    log.error("[articles] Failed to fetch article", {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
});

/**
 * Articles related to the given one: same category first, then the most
 * recently published others. The current article is always excluded.
 */
export const getRelatedArticles = cache(
  async (article: Pick<FullArticle, "id" | "category">, limit = 3): Promise<RelatedArticle[]> => {
    try {
      const sameCategory = await db.article.findMany({
        where: {
          isPublished: true,
          category: article.category,
          id: { not: article.id },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          image: true,
          category: true,
          readTime: true,
          views: true,
          createdAt: true,
        },
        orderBy: [{ isFeatured: "desc" }, { views: "desc" }],
        take: limit,
      });

      if (sameCategory.length >= limit) return sameCategory;

      const remaining = limit - sameCategory.length;
      const fallback = await db.article.findMany({
        where: {
          isPublished: true,
          id: { not: article.id },
          NOT: { category: article.category },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          image: true,
          category: true,
          readTime: true,
          views: true,
          createdAt: true,
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: remaining,
      });

      return [...sameCategory, ...fallback];
    } catch (error) {
      log.warn("[articles] Failed to fetch related articles", {
        articleId: article.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
);

/**
 * Increment the view counter. Never throws — a failed counter update must not
 * break the page.
 */
export async function incrementArticleViews(articleId: string): Promise<void> {
  try {
    await db.article.update({
      where: { id: articleId },
      data: { views: { increment: 1 } },
    });
  } catch (error) {
    log.warn("[articles] Failed to increment views", {
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
