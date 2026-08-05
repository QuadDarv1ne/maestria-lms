import { db } from "@/lib/db";
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
  const where: { isPublished: boolean; category?: string; OR?: any[] } = {
    isPublished: true,
  };

  if (category && category !== "all") {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" as const } },
      { excerpt: { contains: search, mode: "insensitive" as const } },
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

  // Fetch articles and count in parallel
  const [articles, total] = await Promise.all([
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

  const totalPages = Math.ceil(total / limit);

  // Transform dates to ISO strings for client component
  const articlesData = articles.map((a) => ({
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
