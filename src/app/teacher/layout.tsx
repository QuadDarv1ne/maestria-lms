"use client";
import { PageWrapper } from "@/components/PageWrapper";
import { RouterSync } from "@/components/RouterSync";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <RouterSync />
      <PageWrapper withErrorBoundary={true}>{children}</PageWrapper>
    </div>
  );
}
