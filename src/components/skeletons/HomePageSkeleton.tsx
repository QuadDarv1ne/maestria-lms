import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function HomePageSkeleton() {
  return (
    <div>
      {/* Hero skeleton */}
      <section className="bg-gradient-to-br from-blue-800 via-violet-700 to-indigo-900">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <Skeleton className="h-6 w-32 bg-white/20 mb-4 rounded-full" />
          <Skeleton className="h-10 w-96 bg-white/20 mb-2" />
          <Skeleton className="h-10 w-72 bg-white/20 mb-4" />
          <Skeleton className="h-6 w-80 bg-white/20 mb-8" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-40 bg-white/20 rounded-lg" />
            <Skeleton className="h-12 w-40 bg-white/20 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/10 rounded-xl p-4">
                <Skeleton className="h-8 w-20 bg-white/20 mb-2" />
                <Skeleton className="h-4 w-16 bg-white/20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories skeleton */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8">
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <Skeleton className="w-12 h-12 rounded-xl mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto mb-1" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Promo carousel skeleton */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-12">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[300px]">
                <div className="rounded-2xl overflow-hidden border shadow-sm">
                  <Skeleton className="h-44 w-full rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular courses skeleton */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32 hidden sm:block" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-0 shadow-sm overflow-hidden">
                <Skeleton className="h-40 w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex items-center gap-2 pt-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features skeleton */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
                <Skeleton className="h-5 w-32 mx-auto mb-2" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA skeleton */}
      <section className="bg-gradient-to-r from-blue-700 to-violet-700 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <Skeleton className="h-8 w-64 bg-white/20 mx-auto mb-4" />
          <Skeleton className="h-5 w-80 bg-white/20 mx-auto mb-6" />
          <Skeleton className="h-12 w-44 bg-white/20 mx-auto rounded-lg" />
        </div>
      </section>
    </div>
  );
}
