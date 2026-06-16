"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/CourseImage";
import { levelColors, levelLabels } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { Clock, BookOpen, Star, TrendingUp, Percent } from "lucide-react";

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

export const CourseCard = React.memo(function CourseCard({ course, onClick }: CourseCardProps) {
  const locale = useAppStore((s) => s.locale);
  const discount = course.oldPrice && course.oldPrice > course.price
    ? Math.round((1 - course.price / course.oldPrice) * 100)
    : 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border-0 shadow-sm overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="relative h-40 flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600">
          {course.image ? (
            <CourseImage
              src={course.image}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              identifier={course.id}
              loading="lazy"
            />
          ) : course.category?.icon ? (
            <span className="text-5xl opacity-50 group-hover:scale-110 transition-transform duration-500">
              {course.category.icon}
            </span>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {course.price === 0 && (
              <Badge className="bg-green-500 text-white border-0 shadow-sm">
                {t("catalog.free", locale)}
              </Badge>
            )}
            {course.isFeatured && course.price > 0 && (
              <Badge className="bg-amber-500 text-white border-0 shadow-sm">
                <TrendingUp className="w-3 h-3 mr-1" />
                {t("catalog.hit", locale)}
              </Badge>
            )}
            {discount > 0 && (
              <Badge className="bg-red-500 text-white border-0 shadow-sm">
                <Percent className="w-3 h-3 mr-1" />
                -{discount}%
              </Badge>
            )}
          </div>
          <Badge
            className={`absolute top-3 right-3 ${levelColors[course.level] || "bg-gray-100 text-gray-700"} shadow-sm`}
          >
            {t(levelLabels[course.level] || course.level, locale)}
          </Badge>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 text-blue-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 shadow-lg">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="p-4">
          {course.category?.name && (
            <p className="text-xs text-violet-600 font-medium mb-1 group-hover:text-violet-700 transition-colors">
              {course.category.name}
            </p>
          )}
          <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors">
            {course.title}
          </h3>
          {course.teacher?.name && (
            <p className="text-xs text-muted-foreground mb-3">
              {course.teacher.name}
            </p>
          )}

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

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
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
                      {formatNumber(course.oldPrice, locale)} ₽
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">
                    {formatNumber(course.price, locale)} ₽
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CourseCard.displayName = "CourseCard";
