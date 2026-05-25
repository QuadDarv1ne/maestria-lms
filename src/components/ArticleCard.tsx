"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, User } from "lucide-react";

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

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    image: string | null;
    category: string;
    tags: string | null;
    readTime: number;
    views: number;
    isFeatured: boolean;
    createdAt: Date;
    author: {
      id: string;
      name: string | null;
      image: string | null;
      role: string;
    };
  };
  onClick?: () => void;
}

export const ArticleCard = React.memo(function ArticleCard({ article, onClick }: ArticleCardProps) {
  const locale = useAppStore((s) => s.locale);
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

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-0 shadow-sm overflow-hidden group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Cover Image */}
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600">
          {article.image ? (
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl opacity-30">{categoryIcon}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

          {/* Category Badge */}
          <Badge className={`absolute top-3 left-3 border ${categoryColor}`}>
            {categoryIcon} {categoryLabel}
          </Badge>

          {/* Featured Badge */}
          {article.isFeatured && (
            <Badge className="absolute top-3 right-3 bg-amber-500 text-white border-0">
              ⭐ {t("blog.featured", locale)}
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-bold text-lg line-clamp-2 group-hover:text-blue-600 transition-colors">
            {article.title}
          </h3>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {article.excerpt}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{article.readTime} {t("blog.min", locale)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{article.views}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{article.author.name || "Автор"}</span>
            </div>
          </div>

          {/* Date */}
          <div className="text-xs text-muted-foreground">
            {formatDate(article.createdAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
