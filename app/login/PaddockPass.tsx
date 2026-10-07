'use client'

import { useRef, type ReactNode, type PointerEvent } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'

export default function PaddockPass({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const card = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0), y = useMotionValue(0)
  const rotateX = useSpring(x, { stiffness: 110, damping: 22 })
  const rotateY = useSpring(y, { stiffness: 110, damping: 22 })
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== 'mouse' || !card.current) return
    const bounds = card.current.getBoundingClientRect()
    x.set((.5 - (event.clientY - bounds.top) / bounds.height) * 3)
    y.set(((event.clientX - bounds.left) / bounds.width - .5) * 4)
  }
  return <div className="paddock-pass-perspective"><motion.div ref={card} className="paddock-pass" onPointerMove={tilt} onPointerLeave={() => { x.set(0); y.set(0) }} style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY }}>{children}</motion.div></div>
}
