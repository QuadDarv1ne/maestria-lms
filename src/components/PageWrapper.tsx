"use client";

import React, { Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
