import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex w-64 flex-col bg-white border-r border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header Skeleton */}
        <div className="h-16 border-b bg-white px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Content Area Skeleton */}
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large Card */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>

            {/* Side Panel */}
            <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
              <Skeleton className="h-6 w-24" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
