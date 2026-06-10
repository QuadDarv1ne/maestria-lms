"use client";

import { Fragment } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/store";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  locale: Locale;
}

export function Breadcrumbs({ items, locale }: BreadcrumbsProps) {
  const homeLabel = locale === "ru" ? "Главная" : locale === "zh" ? "首页" : "Home";

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
            onClick={() => (window.location.hash = "#home")}
          >
            <Home className="w-4 h-4" />
            <span className="sr-only">{homeLabel}</span>
          </Button>
        </li>
        {items.map((item, index) => (
          <Fragment key={index}>
            <li>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </li>
            <li>
              {item.href && index < items.length - 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto font-normal"
                  onClick={() => (window.location.hash = item.href || "#")}
                >
                  {item.label || "Page"}
                </Button>
              ) : (
                <span className="text-foreground font-medium" aria-current="page">
                  {item.label || "Page"}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

// Helper для генерации breadcrumbs из текущего хеша
export function generateBreadcrumbs(hash: string, locale: Locale): BreadcrumbItem[] {
  const labels: Record<string, Record<Locale, string>> = {
    catalog: {
      ru: "Каталог курсов",
      en: "Course Catalog",
      zh: "课程目录",
    },
    course: {
      ru: "Курс",
      en: "Course",
      zh: "课程",
    },
    profile: {
      ru: "Профиль",
      en: "Profile",
      zh: "个人资料",
    },
    achievements: {
      ru: "Достижения",
      en: "Achievements",
      zh: "成就",
    },
    "course-editor": {
      ru: "Редактор курсов",
      en: "Course Editor",
      zh: "课程编辑器",
    },
    admin: {
      ru: "Админ-панель",
      en: "Admin Panel",
      zh: "管理面板",
    },
  };

  const parts = hash.replace("#", "").split("/");
  const breadcrumbs: BreadcrumbItem[] = [];

  if (parts[0] && parts[0] !== "home") {
    const baseKey = parts[0];
    if (labels[baseKey]) {
      const label = labels[baseKey][locale] || labels[baseKey]["ru"];
      if (label) {
        breadcrumbs.push({
          label,
          href: `#${parts[0]}`,
        });
      }
    }

    // Добавляем дополнительные части пути
    if (parts.length > 1 && parts[1]) {
      if (parts[0] === "course") {
        const courseLabel = labels.course[locale];
        if (courseLabel) {
          breadcrumbs.push({
            label: `${courseLabel} #${parts[1]}`,
            href: `#${parts.join("/")}`,
          });
        }
      }
    }
  }

  return breadcrumbs;
}
