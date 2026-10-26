"use client";

import { useEffect, useState } from "react";
import { List, ChevronDown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  /** Container selector that holds the rendered article HTML. */
  targetSelector?: string;
  /** Minimum heading level to include (2 = h2). */
  minLevel?: number;
  /** Maximum heading level to include (3 = h3). */
  maxLevel?: number;
}

/**
 * Builds a slug that is safe for `id` and unique within the document.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/**
 * Automatically generated table of contents.
 *
 * Reads headings from the rendered article body, assigns stable `id`s (so deep
 * links and scroll-spy work) and highlights the section currently in view.
 */
export function TableOfContents({
  targetSelector = ".article-content",
  minLevel = 2,
  maxLevel = 3,
}: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const locale = useAppStore((s) => s.locale);

  // Collect headings once the article HTML is in the DOM.
  useEffect(() => {
    const container = document.querySelector(targetSelector);
    if (!container) return;

    const used = new Set<string>();
    const headings = Array.from(
      container.querySelectorAll(`h${minLevel}, h${minLevel + 1}, h${maxLevel}`)
    ).filter((el) => el.tagName.length === 2 && /^H[1-6]$/.test(el.tagName));

    const collected: TocItem[] = [];
    for (const heading of headings) {
      const level = Number.parseInt(heading.tagName[1], 10);
      if (level < minLevel || level > maxLevel) continue;
      const text = (heading.textContent || "").trim();
      if (!text) continue;

      let id = heading.id || slugify(text) || `section-${collected.length + 1}`;
      let suffix = 2;
      while (used.has(id)) {
        id = `${slugify(text)}-${suffix++}`;
      }
      used.add(id);
      if (!heading.id) heading.id = id;
      // Offset anchor scrolling so the sticky header does not cover the title.
      (heading as HTMLElement).style.scrollMarginTop = "96px";

      collected.push({ id, text, level });
    }

    // Defer setState into rAF to satisfy the no-sync-state-update lint rule
    // while keeping the TOC visible within one frame of the article render.
    let rafId = 0;
    const schedule = () => {
      rafId = window.requestAnimationFrame(() => setItems(collected));
    };
    schedule();
    return () => window.cancelAnimationFrame(rafId);
  }, [targetSelector, minLevel, maxLevel]);

  // Scroll-spy: highlight the heading nearest the top of the viewport.
  useEffect(() => {
    if (items.length === 0) return;

    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    setIsOpen(false);
    // Keep the URL shareable without jumping twice.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return (
    <nav
      aria-label={t("article.toc", locale)}
      className="rounded-xl border bg-card/60 backdrop-blur-sm p-4"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
          <List className="h-4 w-4" />
          {t("article.toc", locale)}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform lg:hidden ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <ol
        className={`mt-3 space-y-1.5 text-sm ${isOpen ? "block" : "hidden lg:block"}`}
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              className={item.level > minLevel ? "pl-4" : undefined}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={`block border-l-2 py-1 pl-3 leading-snug transition-colors ${
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
