import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the article page. Mirrors the header, cover and body layout of
 * `ArticlePage` so the transition from loading to content is seamless.
 */
export function ArticlePageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <Skeleton className="h-9 w-36 mb-6 rounded-md" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 space-y-4">
          <Skeleton className="h-6 w-32 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
          </div>
          <div className="flex flex-wrap items-center gap-4 pb-6 border-b">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </header>

        {/* Cover */}
        <Skeleton className="w-full aspect-video rounded-xl mb-8" />

        {/* Body */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
          <Skeleton className="h-6 w-1/2 mt-8" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl mt-6" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-9/12" />
            <Skeleton className="h-4 w-11/12" />
          </div>
        </div>
      </div>
    </div>
  );
}
