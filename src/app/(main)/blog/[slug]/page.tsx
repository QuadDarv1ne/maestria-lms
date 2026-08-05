import type { Metadata } from "next";
import { ArticlePage } from "@/components/ArticlePage";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await db.article.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, image: true },
  });

  return {
    title: article ? `${article.title} — Maestria` : "Article — Maestria",
    description: article?.excerpt || "Information technology article",
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  
  // Fetch article data server-side for immediate display
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
