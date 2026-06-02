"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

/**
 * Skip-to-content link for keyboard and screen reader users.
 * Appears on focus to allow jumping past navigation to main content.
 */
export function SkipLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        linkRef.current?.classList.remove("-translate-y-full");
        linkRef.current?.classList.add("translate-y-0");
      }
    };

    const handleFocusOut = () => {
      linkRef.current?.classList.add("-translate-y-full");
      linkRef.current?.classList.remove("translate-y-0");
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <a
      ref={linkRef}
      href="#main-content"
      className="fixed left-4 top-4 z-[100] -translate-y-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform duration-200 focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-white"
    >
      {t("a11y.skipToContent", locale)}
    </a>
  );
}
