interface Props {
  message?: string
}

export default function LoadingState({ message = 'Loading data...' }: Props) {
  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Shimmer skeleton rows */}
      <div className="space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="h-3 w-24 bg-zinc-800 rounded mb-6" />
        <div className="h-10 w-64 bg-zinc-800 rounded mb-10" />

        {/* Card skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
          ))}
        </div>

        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-zinc-900/60 border border-zinc-800/50 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Message */}
      <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-600 mt-8">
        {message}
      </p>
    </div>
  )
}
