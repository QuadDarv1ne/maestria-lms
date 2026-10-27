"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Eye } from "lucide-react";
import type { RelatedArticle } from "@/lib/articles";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

/** Serialized form passed from the server page (dates become ISO strings). */
export type RelatedArticleData = Omit<RelatedArticle, "createdAt"> & { createdAt: string };

interface RelatedArticlesProps {
  articles: RelatedArticleData[];
}

/**
 * "Read also" block rendered after the article body.
 * The related list itself is fetched by the server page and passed down.
 */
export function RelatedArticles({ articles }: RelatedArticlesProps) {
  const locale = useAppStore((s) => s.locale);

  if (articles.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t" aria-labelledby="related-articles-heading">
      <h2 id="related-articles-heading" className="text-xl font-bold mb-6">
        {t("article.related", locale)}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/blog/${article.slug}`}
            className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative h-36 overflow-hidden bg-muted">
              {article.image ? (
                <Image
                  src={article.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl opacity-30">
                  📄
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                {article.title}
              </h3>
              <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.readTime} {t("blog.min", locale)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {article.views}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
