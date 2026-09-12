'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import type { SeasonStation } from '@/lib/season-view'
import { SEASON_LINE_GAP, seasonArcAtY, seasonLinePath, type SeasonAnchor } from '@/lib/season-line-geometry'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function useSeasonJourney(stations: SeasonStation[]) {
  const fieldRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const field = fieldRef.current
    if (!field) return
    const media = gsap.matchMedia()
    media.add({ mobile: '(max-width: 767px)', desktop: '(min-width: 768px)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      const { mobile, reduced } = context.conditions!
      const svg = field.querySelector('svg')!
      const core = svg.querySelector<SVGPathElement>('[data-line-core]')!
      const paths = svg.querySelectorAll<SVGPathElement>('[data-line-path]')
      const clip = svg.querySelector<SVGRectElement>('[data-line-clip]')!
      const marker = svg.querySelector<SVGGElement>('[data-line-marker]')!
      const rows = Array.from(field.querySelectorAll<HTMLElement>('[data-entered]'))
      const arrived = new Set<HTMLElement>()
      const animations: gsap.core.Timeline[] = []
      let anchors: SeasonAnchor[] = []
      let samples: number[] = []
      let length = 0
      let size = ''
      let trigger: ScrollTrigger | undefined

      const arrive = (row: HTMLElement, instant: boolean) => {
        if (arrived.has(row)) return
        arrived.add(row)
        row.dataset.arrived = 'true'
        const copy = row.querySelector<HTMLElement>('[data-race-copy]')!
        const dot = row.querySelector<HTMLElement>('[data-race-dot]')!
        if (instant) { gsap.set(copy, { opacity: 1, y: 0 }); return }
        const timeline = gsap.timeline()
        animations.push(timeline)
        timeline.to(copy, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' }, 0)
        timeline.fromTo(dot, { scale: .65 }, { scale: 1, duration: .45, ease: 'back.out(2)' }, 0)
        // Only the decorative copy counts up; assistive text always has the
        // exact result. Preserve half points rather than rounding the finish.
        const points = row.querySelector<HTMLElement>('[data-race-points]')
        if (points) {
          const target = Number(points.dataset.racePoints)
          const decimals = String(target).split('.')[1]?.length ?? 0
          const counter = { value: 0 }
          timeline.to(counter, { value: target, duration: .65, ease: 'power2.out',
            onUpdate: () => { points.textContent = String(Number(counter.value.toFixed(decimals))) },
            onComplete: () => { points.textContent = String(target) },
          }, .05)
        }
      }

      const build = () => {
        anchors = rows.map((row) => ({
          x: Number(mobile ? row.dataset.xm : row.dataset.x) / 100 * field.clientWidth,
          y: row.offsetTop + row.offsetHeight / 2,
          out: row.dataset.status === 'out',
        }))
        const path = seasonLinePath(anchors)
        paths.forEach((element) => element.setAttribute('d', path))
        if (!path) { marker.style.opacity = '0'; return false }
        length = core.getTotalLength()
        samples = Array.from({ length: 801 }, (_, i) => core.getPointAtLength(i / 800 * length).y)
        return length > 0
      }

      const draw = (progress: number, instant = false) => {
        if (!samples.length) return
        const y = samples[0] + progress * (samples[samples.length - 1] - samples[0])
        // A vertical reveal also handles disconnected subpaths correctly.
        // SVG dash offsets restart per subpath, exposing later segments early.
        clip.setAttribute('height', String(reduced ? field.clientHeight : y))
        const point = core.getPointAtLength(seasonArcAtY(samples, y) * length)
        marker.setAttribute('transform', `translate(${point.x} ${point.y})`)
        const inBreak = anchors.some((anchor) => anchor.out && Math.abs(y - anchor.y) < SEASON_LINE_GAP - 1)
        marker.style.opacity = !reduced && progress > .001 && !inBreak ? '1' : '0'
        anchors.forEach((anchor, index) => {
          if (reduced || y >= anchor.y - (anchor.out ? SEASON_LINE_GAP : 0) - 3) arrive(rows[index], instant || reduced)
        })
      }

      if (!build()) return
      if (!reduced) rows.forEach((row) => {
        // Results remain readable before arrival, on fast scrolls and by
        // keyboard. Never hide the race data behind an animation threshold.
        gsap.set(row.querySelector('[data-race-copy]'), { opacity: .72, y: 10 })
      })
      if (reduced) draw(1, true)
      else {
        trigger = ScrollTrigger.create({
          trigger: field,
          start: () => `top+=${samples[0]} 62%`,
          end: () => `top+=${samples[samples.length - 1]} 62%`,
          onUpdate: (self) => draw(self.progress),
          onRefresh: (self) => draw(self.progress, true),
        })
        draw(trigger.progress, true)
      }

      const onFocus = (event: FocusEvent) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-entered]')
        if (row) arrive(row, true)
      }
      field.addEventListener('focusin', onFocus)
      size = `${field.clientWidth}:${field.clientHeight}`
      const resize = new ResizeObserver(() => {
        const next = `${field.clientWidth}:${field.clientHeight}`
        if (next === size) return
        size = next
        if (!build()) return
        if (reduced) draw(1, true)
        else { trigger?.refresh(); draw(trigger?.progress ?? 0, true) }
      })
      resize.observe(field)
      return () => {
        resize.disconnect()
        field.removeEventListener('focusin', onFocus)
        trigger?.kill()
        animations.forEach((animation) => animation.kill())
        rows.forEach((row) => {
          delete row.dataset.arrived
          const points = row.querySelector<HTMLElement>('[data-race-points]')
          if (points) points.textContent = points.dataset.racePoints!
        })
        clip.setAttribute('height', String(field.clientHeight))
        marker.style.opacity = '0'
      }
    })
    return () => media.revert()
  }, { scope: fieldRef, dependencies: [stations], revertOnUpdate: true })
  return fieldRef
}
