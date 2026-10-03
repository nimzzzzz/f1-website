'use client'

import type { ReactNode } from 'react'
import GameDialog from '@/components/games/GameDialog'

/** Native modal semantics: inert background, Escape, focus trap and restoration. */
export default function FantasyDialog({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  return <GameDialog title={title} onClose={onClose} className={`fantasy-dialog${wide ? ' fantasy-dialog--wide' : ''}`}>{children}</GameDialog>
}
