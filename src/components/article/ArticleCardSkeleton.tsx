import { Skeleton } from "@/components/ui/skeleton";

interface ArticleCardSkeletonProps {
  /** Render the badge placeholders (used on list pages). */
  showBadge?: boolean;
}

/**
 * Skeleton that mirrors the structure of `ArticleCard` so the layout does not
 * jump when real content arrives.
 */
export function ArticleCardSkeleton({ showBadge = true }: ArticleCardSkeletonProps) {
  return (
    <div className="rounded-xl border-0 shadow-sm overflow-hidden bg-card">
      {/* Cover */}
      <div className="relative h-48 overflow-hidden">
        <Skeleton className="h-full w-full rounded-none" />
        {showBadge && (
          <Skeleton className="absolute top-3 left-3 h-6 w-28 rounded-full" />
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="flex items-center gap-4 pt-1">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

/** Grid of article card skeletons. */
export function ArticleCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}
