"use client";

import React, { useEffect, Suspense } from "react";
import { useAppStore } from "@/lib/store";
import { HomePage } from "@/components/HomePage";
import { RouterSync } from "@/components/RouterSync";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialogs } from "@/components/AuthDialogs";
import { CustomCursor } from "@/components/CustomCursor";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Root page (/) — HomePage with full layout.
 * Это единственная страница вне (main) группы, которая имеет
 * свою полную оболочку (Header, Footer, анимации).
 * Все остальные маршруты (/catalog, /profile и т.д.) используют (main)/layout.tsx.
 */
export default function Page() {
  const { setUser } = useAppStore();

  // Загрузка сессии пользователя
  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user) {
            setUser({
              id: session.user.id || "",
              email: session.user.email || "",
              name: session.user.name || null,
              image: session.user.image || null,
              role: session.user.role || "student",
            });
          }
        }
      } catch {
        // Сессия не найдена — пользователь не авторизован
      }
    };

    loadSession();
  }, [setUser]);

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
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <HomePage />
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
