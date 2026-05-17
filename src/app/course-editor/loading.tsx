export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-pulse flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-8 bg-muted rounded w-48 mx-auto" />
        <div className="h-4 bg-muted rounded w-64 mx-auto" />
      </div>
    </div>
  );
}
