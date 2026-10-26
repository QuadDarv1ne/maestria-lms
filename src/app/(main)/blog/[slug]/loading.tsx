import { ArticlePageSkeleton } from "@/components/article/ArticlePageSkeleton";

/**
 * Route-level loading state for /blog/[slug].
 * Uses the shared article skeleton so the real page slots in without a layout
 * shift.
 */
export default function ArticleLoading() {
  return <ArticlePageSkeleton />;
}
