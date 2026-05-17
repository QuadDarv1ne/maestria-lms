"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialogs } from "@/components/AuthDialogs";
import { CustomCursor } from "@/components/CustomCursor";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouterSync } from "@/components/RouterSync";
import { useAppStore } from "@/lib/store";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <RouterSync />
      <CustomCursor />
      <GlobalScrollToTop />
      <Header />
      <main className="flex-1">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <AuthDialogs />
      </Suspense>
    </div>
  );
}
