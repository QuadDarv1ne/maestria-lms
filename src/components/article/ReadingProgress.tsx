"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface ReadingProgressProps {
  /** Selector of the element whose scroll progress should be tracked. */
  targetSelector?: string;
  /** Optional label rendered next to the percentage. */
  showLabel?: boolean;
}

/**
 * Thin progress bar pinned under the site header that fills as the reader
 * scrolls through the article body.
 */
export function ReadingProgress({
  targetSelector = ".article-content",
  showLabel = false,
}: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // Distance the reader has scrolled into the article body.
      const total = rect.height - viewportHeight;
      const scrolled = -rect.top;
      const ratio = total > 0 ? scrolled / total : scrolled > 0 ? 1 : 0;
      setProgress(Math.min(1, Math.max(0, ratio)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetSelector]);

  return (
    <div
      className="sticky top-0 z-40 -mx-4 mb-4 h-1 w-[calc(100%+2rem)] bg-transparent"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-label={t("article.readingProgress", locale)}
    >
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
      {showLabel && progress > 0 && (
        <span className="sr-only">{Math.round(progress * 100)}%</span>
      )}
    </div>
  );
}
