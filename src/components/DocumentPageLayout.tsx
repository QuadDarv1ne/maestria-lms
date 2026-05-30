"use client";

import { type ReactNode } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Home } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/* ═══════════════════════════════════════════════════════════════════════
   ReadingProgressBar — тонкая полоска прогресса чтения документа
   Показывает, сколько документа пользователь уже прочитал (прокрутил)
   ═══════════════════════════════════════════════════════════════════════ */
function ReadingProgressBar() {
  const progress = useScrollProgress();
  const theme = useAppStore((s) => s.theme);

  // Цвет прогресс-бара подстраивается под тему
  const barColor =
    theme === "dark"
      ? "linear-gradient(90deg, #7c6aff, #a78bfa)"
      : theme === "amber"
        ? "linear-gradient(90deg, #b45309, #d97706)"
        : "linear-gradient(90deg, #2962ff, #7c3aed)";

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-transparent">
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{
          width: `${progress}%`,
          background: barColor,
          boxShadow: progress > 0 ? `0 0 8px ${theme === "dark" ? "rgba(124,106,255,0.4)" : theme === "amber" ? "rgba(180,83,9,0.4)" : "rgba(41,98,255,0.3)"}` : "none",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DocumentPageLayout — обёртка для юридических / документальных страниц
   
   Включает:
   - ReadingProgressBar — полоска прогресса чтения вверху
   - ScrollToTopButton — кнопка «Наверх»
   - Стандартную структуру: хлебные крошки, заголовок с иконкой, содержание
   ═══════════════════════════════════════════════════════════════════════ */

interface TocItem {
  id: string;
  label: string;
}

interface DocumentPageLayoutProps {
  /** Иконка для заголовка */
  icon: LucideIcon;
  /** Ключ i18n для заголовка страницы (или готовая строка) */
  title: string;
  /** Дата последнего обновления */
  lastUpdated?: string;
  /** Элементы содержания (id секции + текст) */
  tocItems: TocItem[];
  /** Основное содержимое документа */
  children: ReactNode;
  /** Дополнительный контент под заголовком (например, дисклеймер) */
  headerExtra?: ReactNode;
  /** Футер документа */
  footer?: ReactNode;
}

export function DocumentPageLayout({
  icon: Icon,
  title,
  lastUpdated = "16.05.2026",
  tocItems,
  children,
  headerExtra,
  footer,
}: DocumentPageLayoutProps) {
  const navigate = useAppStore((s) => s.navigate);
  const locale = useAppStore((s) => s.locale);

  return (
    <>
      {/* Прогресс-бар чтения — специфичен для документов */}
      <ReadingProgressBar />

      {/* Кнопка «Наверх» — глобальная (GlobalScrollToTop в page.tsx) */}

      {/* Основной контейнер документа */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Хлебные крошки */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <button
            onClick={() => navigate("home")}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            {t("nav.home", locale)}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{title}</span>
        </nav>

        {/* Заголовок */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-700 to-violet-600 rounded-xl flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-left">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {t("legal.lastUpdate", locale)} {lastUpdated}
              </p>
            </div>
          </div>
          {headerExtra}
        </div>

        {/* Содержание */}
        {tocItems.length > 0 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3">{t("legal.toc", locale)}</h2>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                {tocItems.map((item, _idx) => (
                  <li key={item.id}>
                    <button
                      onClick={() =>
                        document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="hover:text-foreground transition-colors text-left"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Основной контент */}
        <div className="space-y-8 text-left">{children}</div>

        {/* Футер документа */}
        {footer !== undefined ? (
          footer
        ) : (
          <div className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>
              &copy; 2024-2026 Maestria by Maestro7IT. {t("footer.rights", locale)}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
