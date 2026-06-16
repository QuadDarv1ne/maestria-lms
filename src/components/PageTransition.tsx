"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence, type Target } from "framer-motion";

export type PageTransitionVariant =
  | "fade-up"
  | "fade-down"
  | "fade-scale"
  | "slide-left"
  | "slide-right"
  | "none";

interface PageTransitionProps {
  children: ReactNode;
  /** Unique key for the page, typically pathname */
  pageKey: string;
  /** Transition animation variant */
  variant?: PageTransitionVariant;
  /** Animation duration in seconds */
  duration?: number;
  /** Whether to scroll to top on page change */
  scrollToTop?: boolean;
}

interface VariantDef {
  initial: Target;
  animate: Target;
  exit: Target;
}

const variants: Record<PageTransitionVariant, VariantDef> = {
  "fade-up": {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  },
  "fade-down": {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
  "fade-scale": {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.97 },
  },
  "slide-left": {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  },
  "slide-right": {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 30 },
  },
  "none": {
    initial: {},
    animate: {},
    exit: {},
  },
};

const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export function PageTransition({
  children,
  pageKey,
  variant = "fade-up",
  duration = 0.3,
  scrollToTop = true,
}: PageTransitionProps) {
  const prevKey = useRef(pageKey);

  useEffect(() => {
    if (pageKey !== prevKey.current) {
      prevKey.current = pageKey;
      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [pageKey, scrollToTop]);

  const animation = variants[variant];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={animation.initial}
        animate={animation.animate}
        exit={animation.exit}
        transition={{
          duration,
          ease: easeOut,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
