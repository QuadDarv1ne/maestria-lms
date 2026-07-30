import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the main (main) layout pages.
 * Provides a consistent loading experience across all main pages.
 */
export default function MainLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header skeleton */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Skeleton className="h-8 w-32" />
              <div className="hidden md:flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero section skeleton */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Skeleton className="h-10 w-3/4 mx-auto" />
            <Skeleton className="h-5 w-1/2 mx-auto" />
            <div className="flex justify-center gap-3 pt-4">
              <Skeleton className="h-12 w-40 rounded-lg" />
              <Skeleton className="h-12 w-40 rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Course cards skeleton */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer skeleton */}
      <footer className="mt-auto border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="h-4 w-48 mx-auto mt-8" />
        </div>
      </footer>
    </div>
  );
}
