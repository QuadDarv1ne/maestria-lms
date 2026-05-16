"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Star,
  Clock,
  BookOpen,
  TrendingUp,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Gift,
} from "lucide-react";
import type { SortBy } from "@/lib/store";

interface CourseCard {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  level: string;
  duration: string | null;
  isFeatured: boolean;
  rating: number;
  studentCount: number;
  totalLessons: number;
  totalDuration: number;
  teacher: { id: string; name: string | null; image: string | null };
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
}

export function CatalogPage() {
  const { navigate, courseFilters, setCourseFilters, locale } = useAppStore();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [searchInput, setSearchInput] = useState(courseFilters.search);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const levelLabels: Record<string, string> = {
    beginner: t("catalog.beginner", locale),
    intermediate: t("catalog.intermediate", locale),
    advanced: t("catalog.advanced", locale),
  };

  const levelColors: Record<string, string> = {
    beginner: "bg-blue-100 text-blue-700",
    intermediate: "bg-amber-100 text-amber-700",
    advanced: "bg-red-100 text-red-700",
  };

  const categories = [
    { value: "", label: t("catalog.allCategories", locale) },
    { value: "python", label: "Программирование на Python" },
    { value: "web-development", label: "Веб-разработка" },
    { value: "roblox", label: "Создание игр в Roblox" },
    { value: "cpp-csharp", label: "C++/C#" },
    { value: "data-science", label: "Data Science" },
    { value: "mobile-development", label: "Мобильная разработка" },
  ];

  const levels = [
    { value: "", label: t("catalog.allLevels", locale) },
    { value: "beginner", label: t("catalog.beginner", locale) },
    { value: "intermediate", label: t("catalog.intermediate", locale) },
    { value: "advanced", label: t("catalog.advanced", locale) },
  ];

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: "popular", label: t("catalog.sortPopular", locale) },
    { value: "new", label: t("catalog.sortNew", locale) },
    { value: "rating", label: t("catalog.sortRating", locale) },
    { value: "priceAsc", label: t("catalog.sortPriceAsc", locale) },
    { value: "priceDesc", label: t("catalog.sortPriceDesc", locale) },
  ];

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", pagination.page.toString());
        params.set("limit", pagination.limit.toString());
        if (courseFilters.category) params.set("category", courseFilters.category);
        if (courseFilters.search) params.set("search", courseFilters.search);
        if (courseFilters.level) params.set("level", courseFilters.level);
        if (courseFilters.sortBy) params.set("sortBy", courseFilters.sortBy);
        if (courseFilters.freeOnly) params.set("freeOnly", "true");

        const res = await fetch(`/api/courses?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
          setError(null);
          setPagination((prev) => ({
            ...prev,
            total: data.pagination?.total || 0,
            totalPages: data.pagination?.totalPages || 0,
          }));
        } else {
          setError("Ошибка загрузки курсов");
        }
      } catch (e) {
        console.error("Ошибка загрузки курсов:", e);
        setError("Не удалось подключиться к серверу");
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [courseFilters.category, courseFilters.search, courseFilters.level, courseFilters.sortBy, courseFilters.freeOnly, pagination.page, pagination.limit]);

  const handleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCourseFilters({ search: searchInput });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchInput, setCourseFilters]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCourseFilters({ search: "" });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [setCourseFilters]);

  // Debounced live search
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

  const handleCategoryChange = (value: string) => {
    setCourseFilters({ category: value === "__all__" ? "" : value });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleLevelChange = (value: string) => {
    setCourseFilters({ level: value === "__all__" ? "" : value });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSortChange = (value: string) => {
    setCourseFilters({ sortBy: value as SortBy });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleFreeOnlyToggle = () => {
    setCourseFilters({ freeOnly: !courseFilters.freeOnly });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setCourseFilters({ category: "", search: "", level: "", sortBy: "popular", freeOnly: false });
    setSearchInput("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = courseFilters.category || courseFilters.search || courseFilters.level || courseFilters.freeOnly || courseFilters.sortBy !== "popular";

  // Client-side sorting as fallback (API may not support all sort options)
  const sortedCourses = React.useMemo(() => {
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

      {/* Панель поиска и фильтров */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("catalog.search", locale)}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} className="bg-blue-700 hover:bg-blue-800 text-white">
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
        {loading ? t("common.loading", locale) : `${t("catalog.found", locale)} ${pagination.total}`}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="h-40 bg-muted animate-pulse rounded-t-lg" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error && sortedCourses.length === 0 ? (
        <div className="text-center py-16">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{error}</h3>
          <p className="text-muted-foreground mb-4">
            {t("catalog.noResultsHint", locale)}
          </p>
          <Button onClick={() => { setError(null); setPagination((prev) => ({ ...prev, page: prev.page })); }}>
            {t("common.retry", locale) || "Повторить"}
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
            <Card
              key={course.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-0 shadow-sm overflow-hidden"
              onClick={() => navigate(`course/${course.id}`)}
            >
              <CardContent className="p-0">
                <div className="relative h-40 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  {course.category?.icon && (
                    <span className="text-5xl opacity-50">
                      {course.category.icon}
                    </span>
                  )}
                  {course.price === 0 && (
                    <Badge className="absolute top-3 left-3 bg-green-500 text-white border-0">
                      {t("catalog.free", locale)}
                    </Badge>
                  )}
                  {course.isFeatured && course.price > 0 && (
                    <Badge className="absolute top-3 left-3 bg-amber-500 text-white border-0">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {t("catalog.hit", locale)}
                    </Badge>
                  )}
                  <Badge
                    className={`absolute top-3 right-3 ${levelColors[course.level] || "bg-gray-100 text-gray-700"}`}
                  >
                    {levelLabels[course.level] || course.level}
                  </Badge>
                </div>

                <div className="p-4">
                  <p className="text-xs text-violet-600 font-medium mb-1">
                    {course.category?.name}
                  </p>
                  <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {course.teacher?.name}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.totalDuration} {t("common.minutes", locale)}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {course.totalLessons} {t("common.lessons", locale)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-semibold">{course.rating}</span>
                      <span className="text-xs text-muted-foreground">
                        ({course.studentCount})
                      </span>
                    </div>
                    <div>
                      {course.price === 0 ? (
                        <span className="text-sm font-semibold text-green-600">
                          {t("common.free", locale)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {course.oldPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {course.oldPrice.toLocaleString("ru-RU")} ₽
                            </span>
                          )}
                          <span className="text-sm font-bold">
                            {course.price.toLocaleString("ru-RU")} ₽
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Пагинация */}
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
            {t("common.page", locale)} {pagination.page} {t("common.of", locale)} {pagination.totalPages}
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
