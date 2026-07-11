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
  return <ArticlePage slug={slug} />;
}
