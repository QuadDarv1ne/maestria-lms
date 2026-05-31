"use client";

import { PageWrapper } from "@/components/PageWrapper";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageWrapper withErrorBoundary={true}>{children}</PageWrapper>
    </div>
  );
}
