export default function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col h-full w-full animate-pulse ${compact ? 'max-w-[220px] mx-auto' : 'max-w-[280px] mx-auto'}`}
    >
      <div
        className={`relative bg-gray-200 rounded-xl mb-2 overflow-hidden ${compact ? 'aspect-[5/6]' : 'aspect-square'}`}
      >
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer"
          style={{ backgroundSize: '200% 100%' }}
        />
      </div>

      <div className="flex flex-col flex-grow space-y-2 px-1">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto" />
        <div className="h-4 bg-gray-200 rounded w-16 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-20 mx-auto mt-1" />
      </div>
    </div>
  );
}
