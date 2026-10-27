"use client";
import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Eye, User, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeContent } from "@/lib/sanitize";
import { ReadingProgress } from "@/components/article/ReadingProgress";
import { TableOfContents } from "@/components/article/TableOfContents";
import { ArticleImageZoom } from "@/components/article/ArticleImageZoom";
import { ArticleShare } from "@/components/article/ArticleShare";
import { ArticleBreadcrumbs } from "@/components/article/ArticleBreadcrumbs";
import { RelatedArticles, type RelatedArticleData } from "@/components/article/RelatedArticles";
import { ArticlePageSkeleton } from "@/components/article/ArticlePageSkeleton";

/**
 * Check if content is HTML or Markdown.
 * VK-imported articles store rich HTML; admin-authored ones use Markdown.
 */
function isHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/**
 * Article bodies need embeds and external links, but the allow-list, iframe
 * host restrictions and lazy-image handling all come from the shared
 * `sanitizeContent` so there is a single security policy for the whole app.
 */
function renderArticleHtml(html: string): string {
  return sanitizeContent(html, {
    allowIframes: true,
    externalLinks: true,
    lazyImages: true,
  });
}

const categoryColors: Record<string, string> = {
  development: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  testing: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  databases: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  ai: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "3d-modeling": "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  security: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  devops: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
  career: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
};

const categoryIcons: Record<string, string> = {
  development: "💻",
  testing: "🧪",
  databases: "🗄️",
  ai: "🤖",
  "3d-modeling": "🎨",
  security: "🔒",
  devops: "⚙️",
  career: "🚀",
};

interface Article {
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
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
    bio: string | null;
  };
}

interface ArticlePageProps {
  slug: string;
  initialArticle?: Article | null;
  relatedArticles?: RelatedArticleData[];
}

export function ArticlePage({ slug, initialArticle, relatedArticles = [] }: ArticlePageProps) {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [article, setArticle] = useState<Article | null>(initialArticle ?? null);
  const [isLoading, setIsLoading] = useState(initialArticle === undefined);
  const [error, setError] = useState<string | null>(null);

  // Only fetch if no initial data was provided (fallback for direct visits)
  useEffect(() => {
    if (initialArticle !== undefined) return;

    const fetchArticle = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/articles/${slug}`);
        if (!res.ok) throw new Error("Article not found");
        const data = await res.json();
        setArticle(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error", locale));
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [slug, locale, initialArticle]);

  // Record a view after the article is mounted (once per 30 min per server cookie).
  const articleId = article?.id;
  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    fetch(`/api/articles/${slug}/view`, { method: "POST" })
      .then((res) => {
        if (!res.ok) return;
        return res.json() as Promise<{ views?: number; counted?: boolean }>;
      })
      .then((data) => {
        const views = data?.views;
        if (cancelled || typeof views !== "number") return;
        setArticle((prev) => (prev ? { ...prev, views } : prev));
      })
      .catch(() => {
        // A failed view counter must never surface as a user-facing error.
      });
    return () => {
      cancelled = true;
    };
  }, [slug, articleId]);

  if (isLoading) {
    return <ArticlePageSkeleton />;
  }

  if (error || !article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">
            {error || t("article.notFound", locale)}
          </h3>
          <Button onClick={() => router.push("/blog")}>
            {t("article.backToBlog", locale)}
          </Button>
        </div>
      </div>
    );
  }

  const categoryLabel = t(`blog.category.${article.category}`, locale) || article.category;
  const categoryColor = categoryColors[article.category] || "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  const categoryIcon = categoryIcons[article.category] || "📄";

  const tags = article.tags?.split(",").filter(Boolean) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <ArticleBreadcrumbs
        categoryLabel={categoryLabel}
        category={article.category}
        title={article.title}
      />

      <ReadingProgress />

      {/* Back Button */}
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => router.push("/blog")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("article.backToBlog", locale)}
      </Button>

      {/* Mobile TOC */}
      <div className="mb-6 lg:hidden">
        <TableOfContents />
      </div>

      <div className="mx-auto flex max-w-6xl gap-8">
      <article className="min-w-0 flex-1">
        {/* Header */}
        <header className="mb-8">
          {/* Category */}
          <Badge className={`mb-4 ${categoryColor}`}>
            {categoryIcon} {categoryLabel}
          </Badge>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{article.title}</h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-lg text-muted-foreground mb-6">{article.excerpt}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-6 border-b">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{article.author.name || t("article.author", locale)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(article.createdAt, locale)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{article.readTime} {t("blog.min", locale)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>{article.views} {t("article.views", locale)}</span>
            </div>
          </div>
        </header>

        {/* Cover Image */}
        {article.image && (
          <div className="mb-8 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-auto object-cover"
              // The cover is the LCP element on this page: keep it eager and
              // tell the browser to fetch it before anything else on the page.
              fetchPriority="high"
              decoding="async"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-8 article-content">
          {isHtmlContent(article.content) ? (
            <div dangerouslySetInnerHTML={{ __html: renderArticleHtml(article.content) }} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-6 border-t">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag.trim()}
              </Badge>
            ))}
          </div>
        )}

        {/* Share */}
        <div className="mt-8">
          <ArticleShare title={article.title} url={`/blog/${article.slug}`} />
        </div>

        {/* Author Bio */}
        <div className="mt-8 p-6 rounded-lg bg-muted">
          <div className="flex items-start gap-4">
            {article.author.image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={article.author.image}
                alt={article.author.name || ""}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div>
              <h4 className="font-semibold">{article.author.name || t("article.author", locale)}</h4>
              {article.author.bio && (
                <p className="text-sm text-muted-foreground mt-1">
                  {article.author.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Related Articles */}
        <RelatedArticles articles={relatedArticles} />
      </article>

      {/* Desktop TOC sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-24">
          <TableOfContents />
        </div>
      </aside>

      {/* Image lightbox */}
      <ArticleImageZoom />
      </div>
    </div>
  );
}