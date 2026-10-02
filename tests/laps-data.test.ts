import { beforeEach, describe, expect, it, vi } from 'vitest'
import { failResult, okResult } from '@/lib/fetch-result'
import type { Stint } from '@/lib/openf1'

vi.mock('@/lib/client-cache', () => {
  const fetcher = () => Object.assign(vi.fn(), { refresh: vi.fn() })
  return { getCachedStints: fetcher(), getCachedPitStops: fetcher() }
})
import { getCachedStints, getCachedPitStops } from '@/lib/client-cache'
import { getLapContext } from '@/lib/laps-data'
beforeEach(() => vi.resetAllMocks())
describe('optional lap context', () => {
  it('keeps available stints when pit timing fails, without claiming zero stops', async () => {
    const stints = [{ session_key: 7, driver_number: 4, compound: 'SOFT' } as Stint]
    vi.mocked(getCachedStints).mockResolvedValue(okResult(stints))
    vi.mocked(getCachedPitStops).mockResolvedValue(failResult('network'))
    const result = await getLapContext(7)
    expect(result).toEqual(okResult([{ stints, stops: null }]))
  })
  it('distinguishes a successful empty feed from a rejected request', async () => {
    vi.mocked(getCachedStints).mockRejectedValue(new Error('offline'))
    vi.mocked(getCachedPitStops).mockResolvedValue(okResult([]))
    expect(await getLapContext(7)).toEqual(okResult([{ stints: null, stops: [] }]))
  })
  it('bypasses both TTL caches when live polling asks for a refresh', async () => {
    vi.mocked(getCachedStints.refresh).mockResolvedValue(okResult([]))
    vi.mocked(getCachedPitStops.refresh).mockResolvedValue(okResult([]))
    expect(await getLapContext.refresh(7)).toEqual(okResult([{ stints: [], stops: [] }]))
    expect(getCachedStints.refresh).toHaveBeenCalledWith(7)
    expect(getCachedPitStops.refresh).toHaveBeenCalledWith(7)
    expect(getCachedStints).not.toHaveBeenCalled()
  })
})
