"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export function SkipLink() {
  const locale = useAppStore((s) => s.locale);

  return (
    <a
      href="#main-content"
      className="fixed left-4 z-[100] -top-20 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-all duration-200 focus-visible:top-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {t("a11y.skipToContent", locale)}
    </a>
  );
}