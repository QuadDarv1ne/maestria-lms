import type { Metadata } from "next";
import { BlogPageClient } from "@/components/BlogPageClient";
import { getArticlesPage } from "@/lib/articles";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const rawPage = parseInt((params.page as string) || "1", 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.min(10000, Math.max(1, rawPage));

  const title = page > 1
    ? `${t("blog.title")} — ${t("common.page")} ${page}`
    : t("blog.title");

  // Canonical always points at /blog so paginated variants do not compete with
  // the first page in search results.
  const canonical = `${env.siteUrl}/blog`;

  return {
    title,
    description: t("blog.subtitle"),
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description: t("blog.subtitle"),
      url: canonical,
      siteName: "Maestria",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t("blog.subtitle"),
    },
    // Paginated pages carry no unique content value; keep only page 1 indexable.
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
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
