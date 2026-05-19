"use client";


import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/CourseImage";
import { levelColors, levelLabels } from "@/lib/constants";
import { Clock, BookOpen, Star, TrendingUp } from "lucide-react";

interface CourseCardCourse {
  id: string;
  title: string;
  slug?: string;
  image: string | null;
  price: number;
  oldPrice: number | null;
  level: string;
  isFeatured: boolean;
  rating: number;
  studentCount?: number;
  reviewCount?: number;
  totalLessons: number;
  totalDuration: number;
  teacher?: {
    id: string;
    name: string | null;
    image?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color?: string | null;
  } | null;
  shortDesc?: string | null;
}

interface CourseCardProps {
  course: CourseCardCourse;
  onClick?: () => void;
}

export function CourseCard({ course, onClick }: CourseCardProps) {
  const locale = useAppStore((s) => s.locale);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-0 shadow-sm overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="relative h-40 flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600">
          {course.image ? (
            <CourseImage
              src={course.image}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover"
              identifier={course.id}
              loading="lazy"
            />
          ) : course.category?.icon ? (
            <span className="text-5xl opacity-50">
              {course.category.icon}
            </span>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
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
              {course.studentCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ({course.studentCount})
                </span>
              )}
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
                      {course.oldPrice.toLocaleString(locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : "ru-RU")} ₽
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">
                    {course.price.toLocaleString(locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : "ru-RU")} ₽
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
