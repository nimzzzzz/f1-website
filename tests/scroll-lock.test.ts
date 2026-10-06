import { describe, expect, it } from 'vitest'
import { createScrollLock } from '../lib/scroll-lock'

describe('overlay scroll ownership', () => {
  it('unlocks only after all overlapping overlays close, in either order', () => {
    for (const order of [[0, 1], [1, 0]]) {
      let overflow = ''
      const lock = createScrollLock(() => overflow, value => { overflow = value })
      const release = [lock(), lock()]
      expect(overflow).toBe('hidden')
      release[order[0]](); expect(overflow).toBe('hidden')
      release[order[1]](); expect(overflow).toBe('')
      release[order[0]](); expect(overflow).toBe('')
    }
  })
  it('preserves the original overflow and handles cleanup/remount cycles', () => {
    let overflow = 'clip'
    const lock = createScrollLock(() => overflow, value => { overflow = value })
    lock()(); expect(overflow).toBe('clip')
    overflow = ''
    const release = lock(); expect(overflow).toBe('hidden')
    release(); expect(overflow).toBe('')
  })
})
