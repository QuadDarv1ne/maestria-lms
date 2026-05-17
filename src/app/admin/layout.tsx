"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouterSync } from "@/components/RouterSync";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <RouterSync />
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}
