"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Returns the current scroll progress as a percentage (0-100).
 * Uses requestAnimationFrame for smooth, efficient updates.
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      setProgress(percent);
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
    return () => {
      window.removeEventListener("scroll", updateProgress);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateProgress]);

  return progress;
}
