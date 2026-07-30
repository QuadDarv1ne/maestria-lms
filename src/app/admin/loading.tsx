import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the admin layout pages.
 */
export default function AdminLoading() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar skeleton */}
      <aside className="w-64 border-r hidden md:block">
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="border-b px-6 py-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>

            {/* Table skeleton */}
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
