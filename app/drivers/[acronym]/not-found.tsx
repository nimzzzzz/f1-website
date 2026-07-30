import { TransitionLink } from '@/components/motion/TransitionProvider'

export default function DriverNotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-start justify-center gap-6 px-6 md:px-14">
      <p className="label-mono text-[var(--text-dim)]">DRIVER NOT FOUND</p>
      <TransitionLink
        href="/drivers"
        className="label-mono text-[var(--text)] transition-colors hover:text-[var(--accent)]"
      >
        &larr; THE GRID
      </TransitionLink>
    </div>
  )
}
