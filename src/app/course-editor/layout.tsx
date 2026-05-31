"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function CourseEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}
