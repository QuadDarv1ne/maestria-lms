"use client";

import { Suspense, lazy } from "react";
import { HomePage } from "@/components/HomePage";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { PageWrapper } from "@/components/PageWrapper";

const CustomCursor = lazy(() => import("@/components/CustomCursor").then(m => ({ default: m.CustomCursor })));
const AuthDialogs = lazy(() => import("@/components/AuthDialogs").then(m => ({ default: m.AuthDialogs })));

/**
 * Root page (/) — HomePage with full layout.
 * Session is fetched globally in Providers — no need to duplicate here.
 */
export default function Page() {

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
