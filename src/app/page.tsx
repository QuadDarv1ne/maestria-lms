"use client";

import { useEffect, Suspense } from "react";
import { useAppStore } from "@/lib/store";
import { HomePage } from "@/components/HomePage";
import { RouterSync } from "@/components/RouterSync";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialogs } from "@/components/AuthDialogs";
import { CustomCursor } from "@/components/CustomCursor";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { PageWrapper } from "@/components/PageWrapper";

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
      } catch (e) {
        // Session not found — user is not authenticated
        console.warn("Session not found, user is not authenticated:", e);
      }
    };

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <RouterSync />
      <CustomCursor />
      <GlobalScrollToTop />
      <Header />
      <main className="flex-1">
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
