import { db, Prisma, getDatabaseProvider } from "@/lib/db";
import { BlogPageClient } from "@/components/BlogPageClient";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  
  // Read query params for initial fetch
  const page = parseInt((params.page as string) || "1", 10);
  const limit = 12;
  const category = (params.category as string) || "all";
  const search = (params.search as string) || "";
  const sortBy = (params.sortBy as string) || "new";

  // Build where clause
  const where: Prisma.ArticleWhereInput = {
    isPublished: true,
  };

  if (category && category !== "all") {
    where.category = category;
  }

  if (search) {
    // 'mode: insensitive' is only supported by PostgreSQL; SQLite LIKE is case-insensitive natively
    const provider = getDatabaseProvider();
    const searchFilter = provider === "postgresql"
      ? { contains: search, mode: "insensitive" as const }
      : { contains: search };
    where.OR = [
      { title: searchFilter },
      { excerpt: searchFilter },
    ];
  }

  // Build order by
  const orderBy: { isFeatured?: "desc" | "asc"; createdAt?: "desc" | "asc"; views?: "desc" | "asc" }[] = [
    { isFeatured: "desc" },
  ];
  if (sortBy === "popular") {
    orderBy.push({ views: "desc" });
  } else {
    orderBy.push({ createdAt: "desc" });
  }

  const skip = (page - 1) * limit;

  // Fetch articles and count with error handling
  let articles: unknown[] = [];
  let total = 0;

  try {
    [articles, total] = await Promise.all([
      db.article.findMany({
        where,
        select: {
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
  } catch (dbError) {
    // If database query fails, return empty results — the client will handle the error
    console.error("[blog:page] Database query failed:", dbError instanceof Error ? dbError.message : String(dbError));
    articles = [];
    total = 0;
  }

  const totalPages = Math.ceil(total / limit);

  // Transform dates to ISO strings for client component
  const articlesData = (articles as Array<{
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
  }>).map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <BlogPageClient
      initialArticles={articlesData}
      initialPagination={{
        page,
        limit,
        total,
        totalPages,
      }}
    />
  );
}
