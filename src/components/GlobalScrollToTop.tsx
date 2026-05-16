"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { ArrowUp } from "lucide-react";

/**
 * GlobalScrollToTop — глобальная кнопка «Наверх» для всего сайта.
 *
 * Особенности:
 * - Появляется после прокрутки на 300px
 * - Показывает прогресс чтения через SVG-кольцо
 * - Плавно возвращает наверх при клике
 * - Адаптируется под тему (light/dark/amber)
 * - Имеет data-cursor="pointer" для кастомного курсора
 */
export function GlobalScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const { locale, theme } = useAppStore();

  const checkScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      setProgress(percent);
      setVisible(scrollTop > 300);
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => {
      window.removeEventListener("scroll", checkScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [checkScroll]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // SVG-кольцо: 48px viewBox, circle r=20
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Цвета кольца под тему
  const ringColor =
    theme === "dark"
      ? "rgba(124, 106, 255, 0.9)"
      : theme === "amber"
        ? "rgba(180, 83, 9, 0.9)"
        : "rgba(41, 98, 255, 0.9)";
  const trackColor =
    theme === "dark"
      ? "rgba(124, 106, 255, 0.15)"
      : theme === "amber"
        ? "rgba(180, 83, 9, 0.15)"
        : "rgba(41, 98, 255, 0.15)";

  // Процент для тултипа
  const progressPercent = Math.round(progress);

  return (
    <button
      onClick={scrollToTop}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={t("doc.scrollToTop", locale)}
      title={`${progressPercent}% прочитано`}
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center justify-center
        w-12 h-12 rounded-full
        bg-background/80 backdrop-blur-md
        text-foreground shadow-lg
        border border-border/50
        transition-all duration-300 ease-out
        hover:scale-110 hover:shadow-xl hover:border-primary/40
        active:scale-95
        ${visible ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-4 opacity-0 pointer-events-none"}
      `}
      data-cursor="pointer"
    >
      {/* SVG прогресс-кольцо */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        {/* Фоновая дорожка */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth="3"
        />
        {/* Прогресс */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-150 ease-out"
        />
      </svg>
      <ArrowUp
        className={`w-4 h-4 relative z-10 transition-transform duration-300 ${hovered ? "-translate-y-0.5" : ""}`}
      />
    </button>
  );
}
