import type { Metadata } from "next";
import { ArticlePage } from "@/components/ArticlePage";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let article: { title: string; excerpt: string | null; image: string | null } | null = null;
  
  try {
    article = await db.article.findUnique({
      where: { slug },
      select: { title: true, excerpt: true, image: true },
    });
  } catch (error) {
    console.error("[blog:metadata] Database query failed:", error instanceof Error ? error.message : String(error));
  }

  return {
    title: article ? `${article.title} — Maestria` : "Article — Maestria",
    description: article?.excerpt || "Information technology article",
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
    console.error("[blog:slug] Database query failed:", error instanceof Error ? error.message : String(error));
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
