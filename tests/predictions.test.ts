import { describe, expect, it } from 'vitest'
import { CALLS, INITIAL_PREDICTIONS, PREDICTION_DRIVERS, emptyTicket, parsePredictions, potentialPoints, predictionOutcome, predictionStandings, revealTicket, sampleTicket, scoreTicket, sealTicket, setPick, ticketError, type Outcome, type PredictionSave, type Ticket } from '../lib/predictions/game'

const outcome: Outcome = { pole: 'NOR', podium: ['VER', 'LEC', 'RUS'], movers: ['ALB', 'GAS'], safety: true }
const perfect: Ticket = { picks: { pole: 'NOR', first: 'VER', second: 'LEC', third: 'RUS', mover: 'ALB', safety: 'yes' }, boost: 'first' }
const draft = (): PredictionSave => ({ ...INITIAL_PREDICTIONS, draft: structuredClone(perfect), entries: [] })

describe('prediction scoring', () => {
  it('awards 80 points plus the chosen exact confidence bonus', () => {
    const score = scoreTicket(perfect, outcome)
    expect(score).toMatchObject({ total: 105, exact: 6, bonus: 25 })
    expect(score.calls.map(c => c.base)).toEqual([10, 25, 15, 15, 10, 5])
    expect(score.calls.reduce((n, c) => n + c.total, 0)).toBe(score.total)
    expect(potentialPoints(perfect)).toBe(105)
  })
  it('gives partial podium points, with the confidence boost applied to that award', () => {
    const ticket = setPick(perfect, 'first', 'LEC')
    const score = scoreTicket(ticket, outcome)
    expect(score.calls[1]).toMatchObject({ base: 5, bonus: 5, total: 10, verdict: 'partial' })
    expect(score.calls[2]).toMatchObject({ base: 5, bonus: 0, total: 5, verdict: 'partial' })
    expect(score.total).toBe(55)
  })
  it('awards either tied biggest mover and zero for missed calls', () => {
    expect(scoreTicket(setPick(perfect, 'mover', 'GAS'), outcome).calls[4].total).toBe(10)
    const missed = scoreTicket({ ...perfect, picks: { ...perfect.picks, first: 'HAM', safety: 'no' } }, outcome)
    expect(missed.calls[1]).toMatchObject({ base: 0, bonus: 0, total: 0, verdict: 'miss' })
    expect(missed.calls[5].total).toBe(0)
  })
  it('refuses to score incomplete tickets and never invents missing picks', () => {
    expect(() => scoreTicket(emptyTicket(), outcome)).toThrow('incomplete')
    expect(potentialPoints(emptyTicket())).toBe(0)
    expect(potentialPoints(setPick(emptyTicket(), 'pole', 'NOR'))).toBe(10)
  })
})

describe('pick validation and locking', () => {
  it('swaps duplicate podium selections while allowing pole and mover overlap', () => {
    const swapped = setPick(perfect, 'first', 'RUS')
    expect(swapped.picks).toMatchObject({ first: 'RUS', second: 'LEC', third: 'VER' })
    expect(perfect.picks.first).toBe('VER')
    expect(ticketError(setPick(swapped, 'pole', 'RUS'))).toBeNull()
    const partial = setPick(setPick(emptyTicket(), 'first', 'NOR'), 'third', 'NOR')
    expect(partial.picks).toMatchObject({ first: null, third: 'NOR' })
    expect(ticketError(partial, false)).toBeNull()
  })
  it('requires known drivers, unique podium places, a safety answer and one boost', () => {
    expect(ticketError(perfect)).toBeNull()
    for (const ticket of [setPick(perfect, 'first', 'UNKNOWN'), { ...perfect, picks: { ...perfect.picks, second: 'VER' } }, { ...perfect, picks: { ...perfect.picks, safety: null } }, { ...perfect, boost: null }]) expect(ticketError(ticket)).toBeTruthy()
    expect(ticketError(emptyTicket(), false)).toBeNull()
  })
  it('seals a snapshot and refuses another seal or a double reveal', () => {
    const original = draft()
    const sealed = sealTicket(original)
    original.draft.picks.first = 'HAM'
    expect(sealed.entries[0].ticket.picks.first).toBe('VER')
    expect(sealed.entries[0].revealed).toBe(false)
    expect(() => sealTicket(sealed)).toThrow('already sealed')
    const revealed = revealTicket(sealed)
    expect(revealed.entries[0].revealed).toBe(true)
    expect(revealed.draft).toEqual(emptyTicket())
    expect(() => revealTicket(revealed)).toThrow('no sealed ticket')
    expect(sealed.entries[0].revealed).toBe(false)
  })
  it('caps a practice season at 24 and preserves earlier tickets', () => {
    let save = draft()
    for (let round = 1; round <= 24; round++) save = revealTicket(sealTicket({ ...save, draft: sampleTicket(round) }))
    expect(save.entries).toHaveLength(24)
    expect(save.entries[0].ticket).toEqual(sampleTicket(1))
    expect(() => sealTicket({ ...save, draft: perfect })).toThrow('complete')
    expect(parsePredictions(JSON.stringify(save))).toEqual(save)
  })
})

describe('practice persistence and leaderboard integrity', () => {
  it('recomputes totals from original revealed tickets, not supplied totals or drafts', () => {
    const save = revealTicket(sealTicket(draft()))
    const changed = { ...save, draft: sampleTicket(2) }
    expect(predictionStandings(changed)).toEqual(predictionStandings(save))
    expect(parsePredictions(JSON.stringify({ ...save, total: 99999 }))).toEqual(save)
  })
  it('restores sealed tickets without scoring them early', () => {
    const sealed = sealTicket(draft())
    expect(parsePredictions(JSON.stringify(sealed))).toEqual(sealed)
    expect(predictionStandings(sealed).every(row => row.points === 0 && row.races === 0 && row.rank === 1)).toBe(true)
  })
  it('rejects malformed, unknown-version, oversized and non-contiguous saves', () => {
    const sealed = sealTicket(draft())
    for (const raw of [null, '{', 'x'.repeat(30001), JSON.stringify(null), JSON.stringify({ ...sealed, version: 2 }), JSON.stringify({ ...sealed, draft: null }), JSON.stringify({ ...sealed, entries: [{ ...sealed.entries[0], round: 2 }] }), JSON.stringify({ ...sealed, entries: [...sealed.entries, { ...sealed.entries[0], round: 2 }] }), JSON.stringify({ ...sealed, entries: [{ ...sealed.entries[0], ticket: emptyTicket() }] })]) expect(parsePredictions(raw)).toBeNull()
  })
  it('uses one consistent fictional outcome for every participant and valid sample picks', () => {
    const ids = new Set(PREDICTION_DRIVERS.map(driver => driver.id))
    for (let round = 1; round <= 24; round++) {
      const result = predictionOutcome(round)
      expect(result).toEqual(predictionOutcome(round))
      expect(new Set(result.podium).size).toBe(3)
      expect([result.pole, ...result.podium, ...result.movers].every(id => ids.has(id))).toBe(true)
      expect(result.movers.length).toBeGreaterThan(0)
      expect(ticketError(sampleTicket(round))).toBeNull()
      for (const boost of CALLS) expect(scoreTicket({ ...sampleTicket(round), boost }, result).total).toBeLessThanOrEqual(105)
    }
  })
  it('keeps season and latest weekend totals separate and shares equal ranks', () => {
    let save = draft()
    for (let round = 1; round <= 3; round++) save = revealTicket(sealTicket({ ...save, draft: sampleTicket(round) }))
    const rows = predictionStandings(save)
    expect(rows).toHaveLength(16)
    expect(rows.find(r => r.id === 'you')?.points).toBe(save.entries.reduce((n, e) => n + scoreTicket(e.ticket, predictionOutcome(e.round)).total, 0))
    const last = save.entries[2]
    expect(predictionStandings(save, 'round').find(r => r.id === 'you')?.points).toBe(scoreTicket(last.ticket, predictionOutcome(3)).total)
    rows.forEach(row => expect(row.rank).toBe(rows.findIndex(r => r.points === row.points) + 1))
  })
})
