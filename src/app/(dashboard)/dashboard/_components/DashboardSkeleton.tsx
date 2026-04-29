export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white ring-1 ring-gray-200 p-5 space-y-3 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-9 w-9 rounded-xl bg-gray-100" />
          </div>
          <div className="h-7 w-24 rounded bg-gray-100" />
          <div className="h-3 w-32 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function CategoryTableSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white ring-1 ring-gray-200 animate-pulse">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-14 rounded-full bg-gray-100" />
              <div className="h-4 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-4 w-28 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
