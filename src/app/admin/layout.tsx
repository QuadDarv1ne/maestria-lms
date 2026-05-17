"use client";

import { PageWrapper } from "@/components/PageWrapper";
import { RouterSync } from "@/components/RouterSync";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <RouterSync />
      <PageWrapper withErrorBoundary={false}>{children}</PageWrapper>
    </div>
  );
}
