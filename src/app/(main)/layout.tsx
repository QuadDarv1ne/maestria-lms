"use client";

import { Suspense, lazy } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { PageWrapper } from "@/components/PageWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CustomCursor = lazy(() => import("@/components/CustomCursor").then(m => ({ default: m.CustomCursor })));
const AuthDialogs = lazy(() => import("@/components/AuthDialogs").then(m => ({ default: m.AuthDialogs })));

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <CustomCursor />
        </Suspense>
        <GlobalScrollToTop />
        <Header />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          <PageWrapper>
            <PageTransition pageKey={pathname}>
              {children}
            </PageTransition>
          </PageWrapper>
        </main>
        <Footer />
        <Suspense fallback={null}>
          <AuthDialogs />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
