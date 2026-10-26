import Link from "next/link";
import { Clock, Eye } from "lucide-react";
import type { RelatedArticle } from "@/lib/articles";

interface RelatedArticlesProps {
  articles: RelatedArticle[];
  heading?: string;
}

/**
 * "Читайте также" block rendered after the article body.
 * Server component — the related list is fetched by the page.
 */
export function RelatedArticles({ articles, heading = "Читайте также" }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t" aria-labelledby="related-articles-heading">
      <h2 id="related-articles-heading" className="text-xl font-bold mb-6">
        {heading}
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
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={article.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                  {article.readTime} мин
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
