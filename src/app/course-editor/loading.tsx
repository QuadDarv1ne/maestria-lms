import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the course editor layout pages.
 */
export default function CourseEditorLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar with modules */}
        <aside className="w-72 border-r hidden md:block p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-3 border rounded-lg">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="space-y-1 pl-4">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main editor area */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />

            <div className="space-y-4 pt-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Skeleton className="h-10 w-24 rounded-md" />
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
