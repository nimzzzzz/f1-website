import { describe, expect, it } from 'vitest'
import { BUDGET, assignDriver, compareRoles, lineupCost, matchWinner, scoreSquad, validateTeam } from '../lib/fantasy/rules'
import { COMPUTERS, DEFAULT_SAVE, PRACTICE_DRIVERS, buildCup, currentCupNumber, nextMatch, parseSave, playRound, practiceResults, standings } from '../lib/fantasy/practice'
import type { DriverResult, Lineup, SquadScore } from '../lib/fantasy/types'

const lineup: Lineup = { leader: 'NOR', charger: 'ALB', rival: 'GAS' }
const result = (driverId: string, overrides: Partial<DriverResult> = {}): DriverResult => ({ driverId, team: driverId, qualifying: 4, grid: 4, finish: 3, status: 'finished', ...overrides })
const baseResults = [result('NOR'), result('ALB', { grid: 18, finish: 8 }), result('GAS', { team: 'Alpine', qualifying: 8, finish: 10 }), result('COL', { team: 'Alpine', qualifying: 15, finish: 16 })]
const simpleScore = (total: number, bonus = 0, leader = 0): SquadScore => ({ total, bonus, leader, drivers: [] })

describe('fantasy role scoring', () => {
  it('adds separately auditable base points and role bonuses', () => {
    const score = scoreSquad(lineup, baseResults)
    expect(score.drivers[0]).toMatchObject({ base: 24, bonus: 22, total: 46 })
    expect(score.drivers[1]).toMatchObject({ base: 13, bonus: 20, total: 33 })
    expect(score.drivers[2]).toMatchObject({ base: 6, bonus: 13, total: 19 })
    expect(score.total).toBe(98)
    expect(score.bonus).toBe(55)
    score.drivers.forEach(d => expect(d.lines.reduce((n, line) => n + line.points, 0)).toBe(d.total))
  })
  it('changes points when the same drivers are assigned different roles', () => {
    expect(scoreSquad(assignDriver(lineup, 'leader', 'ALB'), baseResults).total).not.toBe(scoreSquad(lineup, baseResults).total)
  })
  it('compares all six role assignments without changing the squad or its base points', () => {
    const original = structuredClone(lineup)
    const comparisons = compareRoles(lineup, baseResults)
    expect(comparisons).toHaveLength(6)
    expect(new Set(comparisons.map(c => c.key)).size).toBe(6)
    expect(comparisons.filter(c => c.actual)).toHaveLength(1)
    expect(comparisons.find(c => c.actual)?.score.total).toBe(98)
    comparisons.forEach(c => {
      expect(Object.values(c.lineup).sort()).toEqual(['ALB', 'GAS', 'NOR'])
      expect(c.score.total - c.score.bonus).toBe(43)
      expect(c.difference).toBe(c.score.total - 98)
    })
    expect(comparisons.map(c => c.score.total)).toEqual(comparisons.map(c => c.score.total).sort((a, b) => b - a))
    expect(lineup).toEqual(original)
  })
  it('caps Charger gains and does not reward missing grid, backwards progress or retirement', () => {
    for (const overrides of [{ grid: null }, { grid: 2, finish: 10 }, { status: 'dnf' as const, finish: 8 }]) {
      expect(scoreSquad(lineup, [result('ALB', overrides)]).drivers[1].bonus).toBe(0)
    }
    expect(scoreSquad(lineup, [result('ALB', { grid: 22, finish: 1 })]).drivers[1].bonus).toBe(20)
  })
  it('does not fabricate teammate bonuses from missing or ambiguous teammates', () => {
    expect(scoreSquad(lineup, [baseResults[2]]).drivers[2].bonus).toBe(0)
    expect(scoreSquad(lineup, [...baseResults, result('THIRD', { team: 'Alpine' })]).drivers[2].bonus).toBe(0)
  })
  it('allows beating a retired teammate, but not DNS or DSQ', () => {
    for (const status of ['dnf', 'dns', 'dsq'] as const) {
      const score = scoreSquad(lineup, [result('GAS', { team: 'Alpine' }), result('COL', { team: 'Alpine', qualifying: null, finish: null, status })])
      expect(score.drivers[2].bonus).toBe(status === 'dnf' ? 8 : 0)
    }
  })
  it('disqualification overrides every positive award', () => {
    expect(scoreSquad(lineup, [result('NOR', { qualifying: 1, finish: 1, status: 'dsq' })]).drivers[0]).toMatchObject({ base: -10, bonus: 0, total: -10 })
  })
  it('handles missing and invalid positions without NaN or phantom wins', () => {
    expect(scoreSquad(lineup, []).total).toBe(0)
    const score = scoreSquad(lineup, [result('NOR', { qualifying: NaN, finish: -1 }), result('ALB', { grid: 0, finish: 2 })])
    expect(Number.isFinite(score.total)).toBe(true)
    expect(score.drivers[0].bonus).toBe(0)
    expect(score.drivers[1].bonus).toBe(0)
  })
})

describe('squad rules and save integrity', () => {
  it('rejects duplicate drivers, unknown drivers, bad identity and over-budget squads', () => {
    expect(validateTeam(DEFAULT_SAVE.team, PRACTICE_DRIVERS)).toBeNull()
    for (const team of [
      { ...DEFAULT_SAVE.team, lineup: { ...lineup, charger: 'NOR' } },
      { ...DEFAULT_SAVE.team, lineup: { ...lineup, rival: 'UNKNOWN' } },
      { ...DEFAULT_SAVE.team, lineup: { leader: 'NOR', charger: 'VER', rival: 'RUS' } },
      { ...DEFAULT_SAVE.team, name: ' ' }, { ...DEFAULT_SAVE.team, colour: 'url(evil)' },
    ]) expect(validateTeam(team, PRACTICE_DRIVERS)).toBeTruthy()
  })
  it('role reassignment swaps existing members and preserves exact budget', () => {
    expect(assignDriver(lineup, 'leader', 'GAS')).toEqual({ leader: 'GAS', charger: 'ALB', rival: 'NOR' })
    expect(lineupCost(assignDriver(lineup, 'leader', 'GAS'), PRACTICE_DRIVERS)).toBe(567)
    COMPUTERS.forEach(c => { expect(lineupCost(c.lineup, PRACTICE_DRIVERS)).toBeLessThanOrEqual(BUDGET); expect(new Set(Object.values(c.lineup)).size).toBe(3) })
  })
  it('persists only identity and original lineups, then recalculates points', () => {
    let save = playRound(DEFAULT_SAVE)
    const first = standings(save).find(t => t.id === 'you')!.total
    save = { ...save, team: { ...save.team, lineup: assignDriver(lineup, 'leader', 'ALB') } }
    expect(standings(save).find(t => t.id === 'you')!.total).toBe(first)
    expect(parseSave(JSON.stringify({ ...save, total: 999999 }))).toEqual(save)
  })
  it('rejects corrupted, duplicate, out-of-order, oversize and future-version saves', () => {
    expect(parseSave('{')).toBeNull()
    expect(parseSave('x'.repeat(25001))).toBeNull()
    expect(parseSave(JSON.stringify({ ...DEFAULT_SAVE, version: 2 }))).toBeNull()
    expect(parseSave(JSON.stringify({ ...DEFAULT_SAVE, entries: [{ round: 2, lineup }] }))).toBeNull()
    expect(parseSave(JSON.stringify({ ...DEFAULT_SAVE, entries: [{ round: 1, lineup }, { round: 1, lineup }] }))).toBeNull()
    expect(parseSave(JSON.stringify({ ...DEFAULT_SAVE, entries: [{ round: 1 }] }))).toBeNull()
  })
})

describe('season championship and knockout cups', () => {
  it('produces the same results for everyone in a practice round', () => {
    expect(practiceResults(1)).toEqual(practiceResults(1))
    expect(practiceResults(1)).not.toEqual(practiceResults(2))
    expect(new Set(practiceResults(1).map(r => r.driverId)).size).toBe(22)
    expect(new Set(practiceResults(1).map(r => r.grid)).size).toBe(22)
  })
  it('uses all four published tiebreak levels', () => {
    const seeds = ['a', 'b']
    expect(matchWinner('a', 'b', simpleScore(9, 50), simpleScore(10), seeds)).toBe('b')
    expect(matchWinner('a', 'b', simpleScore(10, 2), simpleScore(10, 3), seeds)).toBe('b')
    expect(matchWinner('a', 'b', simpleScore(10, 2, 8), simpleScore(10, 2, 9), seeds)).toBe('b')
    expect(matchWinner('a', 'b', simpleScore(10), simpleScore(10), seeds)).toBe('a')
  })
  it('keeps the draw fixed and advances only winners', () => {
    let save = DEFAULT_SAVE
    const draw = buildCup(save, 1).seeds
    for (let i = 1; i <= 4; i++) {
      save = playRound(save)
      const cup = buildCup(save, 1)
      expect(cup.seeds).toEqual(draw)
      expect(cup.stages[i - 1].every(m => m.winner)).toBe(true)
      if (i < 4) {
        expect(cup.stages[i].every(m => !m.winner)).toBe(true)
        expect(cup.stages[i].flatMap(m => [m.a, m.b])).toEqual(cup.stages[i - 1].map(m => m.winner))
      }
    }
    expect(buildCup(save, 1).champion).toBeTruthy()
    expect(currentCupNumber(save.entries.length)).toBe(2)
    expect(buildCup(save, 2).seeds).toEqual(standings(save).map(t => t.id))
    expect(buildCup(save, 2).stages[0].flatMap(m => [m.a, m.b])).toContain('you')
  })
  it('maintains all season scores after elimination and pairs consolation opponents', () => {
    let save = DEFAULT_SAVE
    let hadConsolation = false
    for (let i = 0; i < 24; i++) {
      const match = nextMatch(save)
      expect(match?.opponent.id).not.toBe('you')
      expect(match).not.toBeNull()
      hadConsolation ||= Boolean(match?.consolation)
      save = playRound(save)
      expect(standings(save).every(s => s.scores.length === i + 1)).toBe(true)
    }
    expect(hadConsolation).toBe(true)
    expect(nextMatch(save)).toBeNull()
    expect(() => playRound(save)).toThrow('complete')
    expect(currentCupNumber(24)).toBe(6)
    expect(parseSave(JSON.stringify(save))).toEqual(save)
  })
  it('shares season ranks for tied totals', () => {
    expect(standings(DEFAULT_SAVE).every(s => s.rank === 1)).toBe(true)
  })
})
