import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/ArticlePage";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

interface Props {
  params: Promise<{ slug: string }>;
}

interface ArticleMetadata {
  title: string;
  excerpt: string | null;
  image: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `${env.siteUrl}/blog/${slug}`;

  let article: ArticleMetadata | null = null;

  try {
    article = await db.article.findUnique({
      where: { slug },
      select: {
        title: true,
        excerpt: true,
        image: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    log.error("[blog:metadata] Database query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

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
  let article: {
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
    author: {
      id: string;
      name: string | null;
      image: string | null;
      role: string;
      bio: string | null;
    };
  } | null = null;

  try {
    article = await db.article.findUnique({
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
  } catch (error) {
    log.error("[blog:slug] Database query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Drafts are only reachable by admins/teachers in preview mode; everyone
  // else gets a 404. The API route already enforced this, but the SSR page
  // served the full draft content to anybody who knew the slug.
  if (article && !article.isPublished) {
    const session = await getAuthSession();
    const canPreview =
      !!session?.user &&
      (session.user.role === "admin" || session.user.role === "teacher");
    if (!canPreview) notFound();
  }

  // Transform dates to strings for client component
  const articleData = article
    ? {
        ...article,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      }
    : null;

  return <ArticlePage slug={slug} initialArticle={articleData} />;
}
