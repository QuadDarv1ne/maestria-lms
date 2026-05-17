export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="flex">
        <div className="w-64 h-screen bg-muted p-4 space-y-3">
          <div className="h-6 bg-background/50 rounded w-3/4" />
          <div className="h-4 bg-background/50 rounded w-full" />
          <div className="h-4 bg-background/50 rounded w-5/6" />
          <div className="h-4 bg-background/50 rounded w-2/3" />
        </div>
        <div className="flex-1 p-8 space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
