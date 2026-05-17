"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialogs } from "@/components/AuthDialogs";
import { CustomCursor } from "@/components/CustomCursor";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { PageWrapper } from "@/components/PageWrapper";
import { RouterSync } from "@/components/RouterSync";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <RouterSync />
      <CustomCursor />
      <GlobalScrollToTop />
      <Header />
      <main className="flex-1">
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
  );
}
