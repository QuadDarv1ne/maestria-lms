"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { CatalogSkeleton } from "@/components/skeletons/CatalogSkeleton";
import { Button } from "@/components/ui/button";
import {
  Search,
  SlidersHorizontal,
  X,
  Gift,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortBy } from "@/lib/store";
import { CourseCard } from "@/components/CourseCard";
import { CATEGORIES } from "@/lib/constants";
import { useCourses } from "@/hooks/useCourses";
import { PromoBanner } from "@/components/PromoBanner";

export function CatalogPage() {
  const navigate = useAppStore((s) => s.navigate);
  const courseFilters = useAppStore((s) => s.courseFilters);
  const setCourseFilters = useAppStore((s) => s.setCourseFilters);
  const locale = useAppStore((s) => s.locale);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [searchInput, setSearchInput] = useState(courseFilters.search);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, error } = useCourses({
    page: pagination.page,
    limit: pagination.limit,
    category: courseFilters.category || undefined,
    search: courseFilters.search || undefined,
    level: courseFilters.level || undefined,
    sortBy: courseFilters.sortBy || undefined,
    freeOnly: courseFilters.freeOnly || undefined,
  });

  const courses = useMemo(() => data?.courses ?? [], [data?.courses]);

  const totalPages = data?.pagination?.totalPages ?? 0;
  const total = data?.pagination?.total ?? pagination.total;

  const categories = useMemo(() => [
    { value: "", label: t("catalog.allCategories", locale) },
    ...CATEGORIES.map((c) => ({ value: c.slug, label: t(c.labelKey, locale) })),
  ], [locale]);

  const levels = useMemo(() => [
    { value: "", label: t("catalog.allLevels", locale) },
    { value: "beginner", label: t("catalog.beginner", locale) },
    { value: "intermediate", label: t("catalog.intermediate", locale) },
    { value: "advanced", label: t("catalog.advanced", locale) },
  ], [locale]);

  const sortOptions = useMemo<{ value: SortBy; label: string }[]>(() => [
    { value: "popular", label: t("catalog.sortPopular", locale) },
    { value: "new", label: t("catalog.sortNew", locale) },
    { value: "rating", label: t("catalog.sortRating", locale) },
    { value: "priceAsc", label: t("catalog.sortPriceAsc", locale) },
    { value: "priceDesc", label: t("catalog.sortPriceDesc", locale) },
  ], [locale]);

  // Debounced live search — handles all search updates
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCourseFilters({ search: searchInput });
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, setCourseFilters]);

  const handleCategoryChange = useCallback((value: string) => {
    setCourseFilters({ category: value === "__all__" ? "" : value });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  const handleLevelChange = useCallback((value: string) => {
    setCourseFilters({ level: value === "__all__" ? "" : value });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  const handleSortChange = useCallback((value: string) => {
    setCourseFilters({ sortBy: value as SortBy });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  const handleFreeOnlyToggle = useCallback(() => {
    setCourseFilters((prev: { freeOnly: boolean }) => ({ freeOnly: !prev.freeOnly }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  const clearFilters = useCallback(() => {
    setCourseFilters({ category: "", search: "", level: "", sortBy: "popular", freeOnly: false });
    setSearchInput("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  const hasActiveFilters = courseFilters.category || courseFilters.search || courseFilters.level || courseFilters.freeOnly || courseFilters.sortBy !== "popular";

  // Client-side sorting as fallback (API may not support all sort options)
  const sortedCourses = useMemo(() => {
    const arr = [...courses];
    switch (courseFilters.sortBy) {
      case "rating":
        arr.sort((a, b) => b.rating - a.rating);
        break;
      case "priceAsc":
        arr.sort((a, b) => a.price - b.price);
        break;
      case "priceDesc":
        arr.sort((a, b) => b.price - a.price);
        break;
      case "popular":
        arr.sort((a, b) => b.studentCount - a.studentCount);
        break;
      case "new":
        // If API doesn't return createdAt, keep original order
        break;
    }
    return arr;
  }, [courses, courseFilters.sortBy]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок и поиск */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("catalog.title", locale)}</h1>
        <p className="text-muted-foreground">
          {t("catalog.subtitle", locale)}
        </p>
      </div>

      {/* Промо-баннер */}
      <PromoBanner />

      {/* Панель поиска и фильтров */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("catalog.search", locale)}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setPagination((prev) => ({ ...prev, page: 1 }))}
              className="pl-10"
            />
          </div>
          <Button className="bg-blue-700 hover:bg-blue-800 text-white">
            {t("common.find", locale)}
          </Button>
          <Button
            variant="outline"
            className="md:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <div className={`flex flex-wrap items-center gap-3 ${showFilters ? "flex" : "hidden md:flex"}`}>
          <Select
            value={courseFilters.category || "__all__"}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("catalog.allCategories", locale)} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value || "__all__"} value={cat.value || "__all__"}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={courseFilters.level || "__all__"}
            onValueChange={handleLevelChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("catalog.allLevels", locale)} />
            </SelectTrigger>
            <SelectContent>
              {levels.map((lvl) => (
                <SelectItem key={lvl.value || "__all__"} value={lvl.value || "__all__"}>
                  {lvl.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Фильтр "Бесплатные" */}
          <Button
            variant={courseFilters.freeOnly ? "default" : "outline"}
            size="sm"
            onClick={handleFreeOnlyToggle}
            className={courseFilters.freeOnly ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            <Gift className="w-4 h-4 mr-1" />
            {t("catalog.free", locale)}
          </Button>

          {/* Сортировка */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Select
              value={courseFilters.sortBy}
              onValueChange={handleSortChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("catalog.sortBy", locale)} />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              {t("catalog.clearFilters", locale)}
            </Button>
          )}
        </div>
      </div>

      {/* Результаты */}
      <div className="mb-4 text-sm text-muted-foreground">
        {isLoading ? t("common.loading", locale) : `${t("catalog.found", locale)} ${total}`}
      </div>

      {isLoading ? (
        <CatalogSkeleton />
      ) : error ? (
        <div className="text-center py-16">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{error instanceof Error ? error.message : t("catalog.error", locale)}</h3>
          <p className="text-muted-foreground mb-4">
            {t("catalog.noResultsHint", locale)}
          </p>
          <Button onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}>
            {t("catalog.retry", locale)}
          </Button>
        </div>
      ) : sortedCourses.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("catalog.noResults", locale)}</h3>
          <p className="text-muted-foreground mb-4">
            {t("catalog.noResultsHint", locale)}
          </p>
          <Button variant="outline" onClick={clearFilters}>
            {t("catalog.clearFilters", locale)}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => navigate(`course/${course.id}`)}
            />
          ))}
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
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
            {t("common.page", locale)} {pagination.page} {t("common.of", locale)} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= totalPages}
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
