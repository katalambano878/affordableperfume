'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 bg-white">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-5 bg-red-50 rounded-full flex items-center justify-center">
          <i className="ri-error-warning-line text-3xl text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          The page failed to load. This is often fixed by a refresh after an update.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold"
          >
            Try again
          </button>
          <a
            href="/shop"
            className="px-6 py-3 border-2 border-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-50"
          >
            Go to Shop
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && error?.message ? (
          <p className="mt-6 text-xs text-gray-400 break-all">{error.message}</p>
        ) : null}
      </div>
    </div>
  );
}
