"use client";

import { useReportWebVitals } from "next/web-vitals";

import { log } from "@/lib/logger";

/** Core Web Vitals we forward; the rest of Next's metrics are noise here. */
const TRACKED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

/**
 * Reports Core Web Vitals to `/api/web-vitals`.
 *
 * Deliberately silent and non-blocking: reports go through
 * `navigator.sendBeacon()` (it survives page unload, which is the common case
 * for LCP/CLS) with a keepalive `fetch` as fallback. A failure here must never
 * surface to the user, so every path ends in a debug log at most.
 *
 * Rendered once from the root layout; `useReportWebVitals` only fires in the
 * browser, so the server render is a no-op.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!TRACKED.has(metric.name)) return;

    const sample = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    try {
      const payload = JSON.stringify({ samples: [sample] });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/web-vitals", blob)) return;
      }

      void fetch("/api/web-vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch((error: unknown) => {
        log.debug("Web vitals report failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error: unknown) {
      log.debug("Web vitals report threw", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return null;
}
