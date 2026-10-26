"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface ArticleBreadcrumbsProps {
  /** Human-readable category label (already localized). */
  categoryLabel: string;
  /** Category slug used in the blog filter link. */
  category?: string;
  title: string;
}

/**
 * Breadcrumb navigation for the article page. Also mirrored as JSON-LD
 * (`BreadcrumbList`) in the page metadata for search engines.
 */
export function ArticleBreadcrumbs({ categoryLabel, category, title }: ArticleBreadcrumbsProps) {
  const locale = useAppStore((s) => s.locale);

  return (
    <nav aria-label={t("article.breadcrumbs", locale)} className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">{t("article.home", locale)}</span>
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li>
          <Link href="/blog" className="hover:text-foreground transition-colors">
            {t("article.blog", locale)}
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li>
          {category ? (
            <Link
              href={`/blog?category=${encodeURIComponent(category)}`}
              className="hover:text-foreground transition-colors"
            >
              {categoryLabel}
            </Link>
          ) : (
            <span>{categoryLabel}</span>
          )}
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5" />
        </li>
        <li className="min-w-0 flex-1">
          <span className="line-clamp-1 text-foreground" aria-current="page">
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}
