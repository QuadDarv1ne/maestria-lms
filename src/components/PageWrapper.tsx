"use client";

import { Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface PageWrapperProps {
  children: ReactNode;
  /** Custom loading fallback, defaults to skeleton screen */
  fallback?: ReactNode;
  /** Whether to wrap content in ErrorBoundary (default: true) */
  withErrorBoundary?: boolean;
}

function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

export function PageWrapper({
  children,
  fallback,
  withErrorBoundary = true,
}: PageWrapperProps) {
  const content = (
    <Suspense fallback={fallback ?? <PageSkeleton />}>
      {children}
    </Suspense>
  );

  if (!withErrorBoundary) {
    return content;
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
