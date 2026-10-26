import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/ArticlePage";
import { ArticleJsonLd } from "@/components/article/ArticleJsonLd";
import { getArticleBySlug, getRelatedArticles } from "@/lib/articles";
import { getAuthSession } from "@/lib/auth";
import { env } from "@/lib/env";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `${env.siteUrl}/blog/${slug}`;

  // Shares the query with the page component via React cache().
  const article = await getArticleBySlug(slug);

  const title = article ? `${article.title} — Maestria` : "Article — Maestria";
  const description = article?.excerpt || "Information technology article";

  return {
    title,
    description,
    // An explicit canonical is required here: without it the page inherited the
    // root layout's canonical (the homepage) and search engines were told to
    // index the homepage instead of the article.
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: "Maestria",
      images: article?.image ? [{ url: article.image, alt: article.title }] : undefined,
      publishedTime: article?.createdAt?.toISOString(),
      modifiedTime: article?.updatedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: article?.image ? [article.image] : undefined,
    },
    // Draft articles must never be indexed.
    robots: article && !article.isPublished ? { index: false, follow: false } : undefined,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  // Fetch article data server-side for immediate display
  const article = await getArticleBySlug(slug);

  if (!article) {
    // A missing slug and a database failure are both indistinguishable here;
    // the API route returns 404 for the former, so we do the same.
    notFound();
  }

  // Drafts are only reachable by admins/teachers in preview mode; everyone
  // else gets a 404. The API route already enforced this, but the SSR page
  // served the full draft content to anybody who knew the slug.
  if (!article.isPublished) {
    const session = await getAuthSession();
    const canPreview =
      !!session?.user &&
      (session.user.role === "admin" || session.user.role === "teacher");
    if (!canPreview) notFound();
  }

  const related = await getRelatedArticles({ id: article.id, category: article.category });

  // Transform dates to strings for client component
  const articleData = {
    ...article,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };

  const relatedData = related.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <>
      <ArticleJsonLd
        article={{
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          image: article.image,
          category: article.category,
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
          readTime: article.readTime,
          authorName: article.author.name,
        }}
      />
      <ArticlePage slug={slug} initialArticle={articleData} relatedArticles={relatedData} />
    </>
  );
}
