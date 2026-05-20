"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { useAppStore, type Locale } from "@/lib/store";
import { promoCourseIds, type PromoCourseData } from "@/lib/promo-courses";

/* Компонент изображения: Next.js Image для локальных, обычный img для внешних */
function CourseImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const isExternal = src.startsWith("http");

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 animate-pulse" />
      )}
      {isExternal ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          crossOrigin="anonymous"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover transition-all duration-500 group-hover:scale-110 ${loaded ? "opacity-100" : "opacity-0"}`}
          sizes="(max-width: 768px) 100vw, 400px"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

function PromoCard({ course, locale }: { course: PromoCourseData; locale: Locale }) {
  const title = t(course.titleKey, locale);
  const description = t(course.descriptionKey, locale);
  const tag = t(course.tagKey, locale);
  const duration = t(course.durationKey, locale);
  const level = t(course.levelKey, locale);

  return (
    <a
      href={course.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-[300px] sm:w-[320px]"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden border border-slate-100 dark:border-slate-700 group h-full" data-cursor="card">
        {/* Image */}
        <div className="relative h-44 overflow-hidden">
          <CourseImage src={course.image} alt={title} />
          {/* Image overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge className={`${course.tagColor} text-[10px] font-semibold px-2 py-0.5 border-0`}>
              {tag}
            </Badge>
            {course.isNew && (
              <Badge className="bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 border-0">
                {t("promo.new", locale)}
              </Badge>
            )}
            {course.isHot && (
              <Badge className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 border-0 flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5" />
                {t("promo.hit", locale)}
              </Badge>
            )}
          </div>

          {/* Level Badge */}
          <Badge className={`absolute bottom-3 right-3 ${course.levelColor} text-[10px] font-semibold px-2 py-0.5 border-0`}>
            {level}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-2">
          {/* Rating & Duration */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground">{course.rating}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {duration}
            </span>
            <ExternalLink className="w-3 h-3 ml-auto text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>

          {/* Title */}
          <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
            {title}
          </h3>

          {/* Description */}
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}

export function CoursePromoCarousel() {
  const rawLocale = useAppStore((s) => s.locale);
  const locale = rawLocale as Locale;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 340;
    const scrollAmount = direction === "left" ? -cardWidth : cardWidth;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(checkScrollPosition, 400);
  }, [checkScrollPosition]);

  // Auto-scroll
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 5) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll("right");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, scroll]);

  // Check scroll on mount and resize
  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, [checkScrollPosition]);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold">
              {t("promo.title", locale)}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-violet-600 to-amber-500">
                Stepik
              </span>
            </h2>
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        {/* Carousel Container */}
        <div
          className="relative group/carousel"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left Gradient Fade */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-50 dark:from-slate-900 to-transparent z-10 pointer-events-none" />

          {/* Right Gradient Fade */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-slate-950 to-transparent z-10 pointer-events-none" />

          {/* Left Navigation Button */}
          {canScrollLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 w-10 h-10 rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
              onClick={() => scroll("left")}
              aria-label={t("promo.scrollLeft", locale)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Right Navigation Button */}
          {canScrollRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 w-10 h-10 rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
              onClick={() => scroll("right")}
              aria-label={t("promo.scrollRight", locale)}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}

          {/* Scrollable Track */}
          <div
            ref={scrollRef}
            onScroll={checkScrollPosition}
            className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-6 py-2"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {promoCourseIds.map((course) => (
              <PromoCard key={course.id} course={course} locale={locale} />
            ))}
          </div>
        </div>

        {/* Course Count Indicator */}
        <div className="text-center mt-6 flex items-center justify-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {promoCourseIds.length} {t("promo.coursesAvailable", locale)}
          </p>
        </div>
      </div>
    </section>
  );
}
