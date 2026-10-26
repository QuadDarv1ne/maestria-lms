import { Skeleton } from "@/components/ui/skeleton";
import { ArticleCardSkeletonGrid } from "@/components/article/ArticleCardSkeleton";

/**
 * Route-level loading state for /blog.
 * Renders the search/filter chrome plus a grid of card skeletons so the
 * transition from navigation to content feels instant.
 */
export default function BlogLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md md:hidden" />
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Skeleton className="h-10 w-[200px] rounded-md" />
          <Skeleton className="h-10 w-[180px] rounded-md" />
        </div>
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-32 mb-4" />

      {/* Cards */}
      <ArticleCardSkeletonGrid count={6} />
    </div>
  );
}
