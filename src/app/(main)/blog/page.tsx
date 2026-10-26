import { BlogPageClient } from "@/components/BlogPageClient";
import { getArticlesPage } from "@/lib/articles";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Read query params for initial fetch
  const rawPage = parseInt((params.page as string) || "1", 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.min(10000, Math.max(1, rawPage));
  const limit = 12;
  const category = (params.category as string) || "all";
  const search = (params.search as string) || "";
  const sortBy = params.sortBy === "popular" ? ("popular" as const) : ("new" as const);

  const { articles, total, totalPages } = await getArticlesPage({
    page,
    limit,
    category,
    search,
    sortBy,
  });

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
