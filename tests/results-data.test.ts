import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Position, SessionResult, Session } from '@/lib/openf1'
import { failResult, okResult } from '@/lib/fetch-result'

vi.mock('@/lib/client-cache', () => {
  const fetcher = () => Object.assign(vi.fn(), { refresh: vi.fn() })
  return { getCachedPositions: fetcher(), getCachedSessionResult: fetcher(), getCachedStartingGrid: fetcher(), getCachedPitStops: fetcher(), getCachedSessions: vi.fn() }
})
import { getCachedPositions, getCachedSessionResult, getCachedStartingGrid, getCachedPitStops, getCachedSessions } from '@/lib/client-cache'
import { getRaceExtras, getResultClassification } from '@/lib/results-data'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCachedSessions).mockResolvedValue(okResult([
    { session_key: 11, meeting_key: 3, session_name: 'Qualifying', session_type: 'Qualifying', date_start: '2026-09-01T12:00:00Z' } as Session,
    { session_key: 12, meeting_key: 3, session_name: 'Race', session_type: 'Race', date_start: '2026-09-02T12:00:00Z' } as Session,
  ]))
})
describe('results fetch contract', () => {
  it('loads published classification without requiring the position history', async () => {
    vi.mocked(getCachedSessionResult).mockResolvedValue(okResult([{ driver_number: 1, position: 2 } as SessionResult]))
    const response = await getResultClassification(12)
    expect(response.ok && response.rows[0].position).toBe(2)
    expect(getCachedPositions).not.toHaveBeenCalled()
  })
  it('uses position history when publication is unavailable', async () => {
    vi.mocked(getCachedSessionResult).mockResolvedValue(failResult('rate-limited', 429))
    vi.mocked(getCachedPositions).mockResolvedValue(okResult([{ driver_number: 1, position: 1, date: '2026-09-01T14:00:00Z' } as Position]))
    const response = await getResultClassification(12)
    expect(response.ok && response.rows[0].detail).toBeNull()
  })
  it('does not turn a publication outage plus empty timing into a no-results claim', async () => {
    vi.mocked(getCachedSessionResult).mockResolvedValue(failResult('blocked', 401))
    vi.mocked(getCachedPositions).mockResolvedValue(okResult([]))
    expect(await getResultClassification(12)).toEqual(failResult('blocked', 401))
  })
  it('bypasses both caches for live polling until publication appears', async () => {
    vi.mocked(getCachedSessionResult.refresh).mockResolvedValue(okResult([]))
    vi.mocked(getCachedPositions.refresh).mockResolvedValue(okResult([]))
    await getResultClassification.refresh(12)
    expect(getCachedSessionResult.refresh).toHaveBeenCalledWith(12)
    expect(getCachedPositions.refresh).toHaveBeenCalledWith(12)
    expect(getCachedPositions).not.toHaveBeenCalled()
  })
  it('distinguishes unknown stop counts from a successful zero-stop session', async () => {
    vi.mocked(getCachedStartingGrid).mockResolvedValue(okResult([]))
    vi.mocked(getCachedPositions).mockResolvedValue(okResult([]))
    vi.mocked(getCachedPitStops).mockResolvedValue(failResult('network'))
    const failed = await getRaceExtras(12)
    expect(getCachedStartingGrid).toHaveBeenCalledWith(11)
    expect(failed.ok && failed.rows[0].stops).toBeNull()
    vi.mocked(getCachedPitStops).mockResolvedValue(okResult([]))
    const empty = await getRaceExtras(12)
    expect(empty.ok && empty.rows[0].stops).toEqual([])
  })
})
