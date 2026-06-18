"use client";
import { useRouter } from "next/navigation";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArticleCard } from "@/components/ArticleCard";
import { Search, X, BookOpen, SlidersHorizontal } from "lucide-react";

const CATEGORIES = [
  { value: "all", labelKey: "blog.allCategories" },
  { value: "development", labelKey: "blog.category.development" },
  { value: "testing", labelKey: "blog.category.testing" },
  { value: "databases", labelKey: "blog.category.databases" },
  { value: "ai", labelKey: "blog.category.ai" },
  { value: "3d-modeling", labelKey: "blog.category.3d-modeling" },
  { value: "security", labelKey: "blog.category.security" },
  { value: "devops", labelKey: "blog.category.devops" },
  { value: "career", labelKey: "blog.category.career" },
];

interface Article {
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
}

export function BlogPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    category: "all",
    search: "",
    sortBy: "new",
  });
  const [searchInput, setSearchInput] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Fetch articles
  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          sortBy: filters.sortBy,
        });

        if (filters.category !== "all") {
          params.set("category", filters.category);
        }
        if (filters.search) {
          params.set("search", filters.search);
        }

        const res = await fetch(`/api/articles?${params}`);
        if (!res.ok) throw new Error("Failed to fetch articles");

        const data = await res.json();
        setArticles(data.articles);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error", locale));
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, [pagination.page, pagination.limit, filters.category, filters.search, filters.sortBy, locale]);

  const handleCategoryChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, category: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, sortBy: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ category: "all", search: "", sortBy: "new" });
    setSearchInput("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const categories = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        value: c.value,
        label: t(c.labelKey, locale),
      })),
    [locale]
  );

  const sortOptions = useMemo(
    () => [
      { value: "new", label: t("blog.sortNew", locale) },
      { value: "popular", label: t("blog.sortPopular", locale) },
    ],
    [locale]
  );

  const hasActiveFilters =
    filters.category !== "all" || filters.search || filters.sortBy !== "new";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("blog.title", locale)}</h1>
        <p className="text-muted-foreground">{t("blog.subtitle", locale)}</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("blog.search", locale)}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            className="md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <div
          className={`flex flex-wrap items-center gap-3 ${
            showFilters ? "flex" : "hidden md:flex"
          }`}
        >
          <Select value={filters.category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("blog.allCategories", locale)} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("blog.sortBy", locale)} />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              {t("blog.clearFilters", locale)}
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted-foreground">
        {isLoading
          ? t("common.loading", locale)
          : `${t("blog.found", locale)} ${pagination.total}`}
      </div>

      {/* Articles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-muted h-80"
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{error}</h3>
          <p className="text-muted-foreground mb-4">
            {t("blog.noResultsHint", locale)}
          </p>
          <Button
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: 1 }))
            }
          >
            {t("blog.retry", locale)}
          </Button>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t("blog.noResults", locale)}
          </h3>
          <p className="text-muted-foreground mb-4">
            {t("blog.noResultsHint", locale)}
          </p>
          <Button variant="outline" onClick={clearFilters}>
            {t("blog.clearFilters", locale)}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={() => router.push(`/blog/${article.slug}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            {t("common.back", locale)}
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            {t("common.page", locale)} {pagination.page}{" "}
            {t("common.of", locale)} {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            {t("common.next", locale)}
          </Button>
        </div>
      )}
    </div>
  );
}