import { TransitionLink } from '@/components/motion/TransitionProvider'

export default function TeamNotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-start justify-center gap-6 px-6 md:px-14">
      <p className="label-mono text-[var(--text-dim)]">TEAM NOT FOUND</p>
      <TransitionLink
        href="/teams"
        className="label-mono text-[var(--text)] transition-colors hover:text-[var(--accent)]"
      >
        &larr; ALL TEAMS
      </TransitionLink>
    </div>
  )
}
