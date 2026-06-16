"use client";

import { useEffect, Suspense, lazy } from "react";
import { useAppStore } from "@/lib/store";
import { HomePage } from "@/components/HomePage";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { PageWrapper } from "@/components/PageWrapper";
import { log } from "@/lib/logger";

const CustomCursor = lazy(() => import("@/components/CustomCursor").then(m => ({ default: m.CustomCursor })));
const AuthDialogs = lazy(() => import("@/components/AuthDialogs").then(m => ({ default: m.AuthDialogs })));

/**
 * Root page (/) — HomePage with full layout.
 * Это единственная страница вне (main) группы, которая имеет
 * свою полную оболочку (Header, Footer, анимации).
 * Все остальные маршруты (/catalog, /profile и т.д.) используют (main)/layout.tsx.
 */
export default function Page() {
  const setUser = useAppStore((s) => s.setUser);

  // Загрузка сессии пользователя
  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user && !cancelled) {
            setUser({
              id: session.user.id || "",
              email: session.user.email || "",
              name: session.user.name || null,
              image: session.user.image || null,
              role: session.user.role || "student",
            });
          }
        }
      } catch (error: unknown) {
        log.debug("Session load skipped for unauthenticated user", { error: error instanceof Error ? error.message : String(error) });
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Suspense fallback={null}>
        <CustomCursor />
      </Suspense>
      <GlobalScrollToTop />
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <PageWrapper>
          <PageTransition pageKey="home">
            <HomePage />
          </PageTransition>
        </PageWrapper>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <AuthDialogs />
      </Suspense>
    </div>
  );
}
