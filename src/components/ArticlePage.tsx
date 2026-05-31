"use client";
import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Eye, User, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

const categoryColors: Record<string, string> = {
  development: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200",
  testing: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200",
  databases: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-200",
  ai: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200",
  "3d-modeling": "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200",
  security: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200",
  devops: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200",
  career: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200",
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
  createdAt: Date;
  updatedAt: Date;
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
}

export function ArticlePage({ slug }: ArticlePageProps) {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/articles/${slug}`);
        if (!res.ok) throw new Error("Article not found");
        const data = await res.json();
        setArticle(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) fetchArticle();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8 max-w-4xl mx-auto">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-64 bg-muted rounded" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
          </div>
        </div>
      </div>
    );
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
  const categoryColor = categoryColors[article.category] || "bg-gray-500/10 text-gray-700 border-gray-200";
  const categoryIcon = categoryIcons[article.category] || "📄";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "zh" ? "zh-CN" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const tags = article.tags?.split(",").filter(Boolean) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => router.push("/blog")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t("article.backToBlog", locale)}
      </Button>

      <article className="max-w-4xl mx-auto">
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
              <span>{article.author.name || "Автор"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(article.createdAt)}</span>
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
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
          <ReactMarkdown>{article.content}</ReactMarkdown>
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
              <h4 className="font-semibold">{article.author.name || "Автор"}</h4>
              {article.author.bio && (
                <p className="text-sm text-muted-foreground mt-1">
                  {article.author.bio}
                </p>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}