import { FALLBACK_DRIVER_CARDS } from '@/lib/roster-fallback'

// Independent practice adapter. Never mix these entries or totals into Fantasy.
export const PREDICTION_DRIVERS = FALLBACK_DRIVER_CARDS.map(d => ({ id: d.acronym, first: d.first, name: d.surname, team: d.team, colour: `#${d.colour}`, number: d.number }))
export const CALLS = ['pole', 'first', 'second', 'third', 'mover', 'safety'] as const
export type Call = typeof CALLS[number]
export type DriverCall = Exclude<Call, 'safety'>
export type Picks = Record<DriverCall, string | null> & { safety: 'yes' | 'no' | null }
export interface Ticket { picks: Picks; boost: Call | null }
export interface Entry { round: number; ticket: Ticket; revealed: boolean }
export interface PredictionSave { version: 1; name: string; draft: Ticket; entries: Entry[] }
export interface Outcome { pole: string; podium: [string, string, string]; movers: string[]; safety: boolean }
export interface CallScore { call: Call; picked: string; actual: string; base: number; bonus: number; total: number; verdict: 'exact' | 'partial' | 'miss' }
export interface TicketScore { total: number; exact: number; bonus: number; calls: CallScore[] }
export const PREDICTION_ROUNDS = 24
export const PREDICTION_STORAGE = 'lights-out:predictions:practice:v1'
export const CALL_INFO: Record<Call, { label: string; points: number; description: string }> = {
  pole: { label: 'Pole position', points: 10, description: 'Who takes pole in Grand Prix qualifying?' },
  first: { label: 'Race winner', points: 25, description: 'Who takes the top step?' },
  second: { label: 'Second place', points: 15, description: 'Who finishes P2?' },
  third: { label: 'Third place', points: 15, description: 'Who finishes P3?' },
  mover: { label: 'Biggest mover', points: 10, description: 'Who gains the most places from their starting grid position?' },
  safety: { label: 'Safety car', points: 5, description: 'Will a full safety car be deployed during the race? VSC does not count.' },
}
export function emptyTicket(): Ticket { return { picks: { pole: null, first: null, second: null, third: null, mover: null, safety: null }, boost: null } }
export const INITIAL_PREDICTIONS: PredictionSave = { version: 1, name: 'Race Reader', draft: emptyTicket(), entries: [] }
const PODIUM: DriverCall[] = ['first', 'second', 'third']
export function setPick(ticket: Ticket, call: DriverCall, id: string): Ticket {
  const picks = { ...ticket.picks }
  // Swapping podium slots avoids duplicates without forcing another trip through the picker.
  const existing = PODIUM.find(c => c !== call && picks[c] === id)
  if (PODIUM.includes(call) && existing) picks[existing] = picks[call]
  picks[call] = id
  return { ...ticket, picks }
}
export function ticketError(ticket: Ticket, complete = true, eligible: readonly string[] = PREDICTION_DRIVERS.map(d => d.id)): string | null {
  if (!ticket?.picks || !Object.prototype.hasOwnProperty.call(ticket.picks, 'safety')) return 'Your ticket could not be read.'
  for (const call of CALLS.filter(c => c !== 'safety') as DriverCall[]) {
    const id = ticket.picks[call]
    if (id === null && !complete) continue
    if (!eligible.includes(id as string)) return 'Choose a driver for every call.'
  }
  const podium = PODIUM.map(c => ticket.picks[c]).filter(Boolean)
  if (new Set(podium).size !== podium.length) return 'Choose three different drivers for the podium.'
  if (!['yes', 'no', ...(complete ? [] : [null])].includes(ticket.picks.safety)) return 'Make your safety car call.'
  if (!(ticket.boost === null && !complete) && !CALLS.includes(ticket.boost as Call)) return 'Choose one confidence boost.'
  return null
}
export function potentialPoints(ticket: Ticket): number {
  return CALLS.reduce((sum, call) => sum + (ticket.picks[call] !== null ? CALL_INFO[call].points : 0), 0) + (ticket.boost && ticket.picks[ticket.boost] !== null ? CALL_INFO[ticket.boost].points : 0)
}
const displayDriver = (id: string) => PREDICTION_DRIVERS.find(d => d.id === id)?.name ?? id
export function pickLabel(value: string | null) { return value === null ? 'Not chosen' : value === 'yes' ? 'Yes' : value === 'no' ? 'No' : displayDriver(value) }
export function scoreTicket(ticket: Ticket, outcome: Outcome, eligible?: readonly string[]): TicketScore {
  if (ticketError(ticket, true, eligible)) throw new Error('Cannot score an incomplete or invalid ticket.')
  const actual: Record<Call, string> = { pole: outcome.pole, first: outcome.podium[0], second: outcome.podium[1], third: outcome.podium[2], mover: outcome.movers.join(' / '), safety: outcome.safety ? 'yes' : 'no' }
  const calls = CALLS.map(call => {
    const picked = ticket.picks[call]!
    const exact = call === 'mover' ? outcome.movers.includes(picked) : picked === actual[call]
    const partial = !exact && PODIUM.includes(call as DriverCall) && outcome.podium.includes(picked)
    const base = exact ? CALL_INFO[call].points : partial ? 5 : 0
    const bonus = ticket.boost === call ? base : 0
    return { call, picked, actual: call === 'mover' ? outcome.movers.map(displayDriver).join(' / ') : pickLabel(actual[call]), base, bonus, total: base + bonus, verdict: exact ? 'exact' as const : partial ? 'partial' as const : 'miss' as const }
  })
  return { total: calls.reduce((n, c) => n + c.total, 0), exact: calls.filter(c => c.verdict === 'exact').length, bonus: calls.reduce((n, c) => n + c.bonus, 0), calls }
}

function rng(seed: number) { let state = seed | 0; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 } }
const PRACTICE_ORDER = ['NOR', 'VER', 'RUS', 'LEC', 'ANT', 'HAM', 'PIA', 'HAD', 'GAS', 'SAI', 'ALB', 'ALO', 'BEA', 'LAW', 'HUL', 'COL', 'OCO', 'LIN', 'BOR', 'STR', 'PER', 'BOT']
/** Fictional sessions. No real event or date is attached to this adapter. */
export function predictionOutcome(round: number): Outcome {
  const random = rng(round * 104729 + 72341)
  const grid = PRACTICE_ORDER.map((id, i) => ({ id, pace: 25 - i + random() * 24 })).sort((a, b) => b.pace - a.pace)
  const race = grid.map((d, i) => ({ ...d, grid: i + 1, pace: d.pace + random() * 30, retired: random() < .07 })).sort((a, b) => Number(a.retired) - Number(b.retired) || b.pace - a.pace)
  const gains = race.map((d, i) => d.retired ? -Infinity : d.grid - i - 1)
  const most = Math.max(...gains)
  return { pole: grid[0].id, podium: race.slice(0, 3).map(d => d.id) as Outcome['podium'], movers: race.filter((_, i) => gains[i] === most).map(d => d.id), safety: random() < .45 }
}
export function sampleTicket(round: number): Ticket {
  const random = rng(399 + round * 367)
  const drivers = PRACTICE_ORDER.slice(0, 9)
  const podium = drivers.map(id => ({ id, key: random() })).sort((a, b) => a.key - b.key).slice(0, 3)
  return { picks: { pole: PRACTICE_ORDER[Math.floor(random() * 7)], first: podium[0].id, second: podium[1].id, third: podium[2].id, mover: PRACTICE_ORDER[Math.floor(random() * 22)], safety: random() > .5 ? 'yes' : 'no' }, boost: CALLS[Math.floor(random() * CALLS.length)] }
}
export function sealTicket(save: PredictionSave): PredictionSave {
  const error = ticketError(save.draft)
  if (error) throw new Error(error)
  if (save.entries.at(-1)?.revealed === false) throw new Error('Your current ticket is already sealed.')
  if (save.entries.length >= PREDICTION_ROUNDS) throw new Error('The practice season is complete.')
  return { ...save, entries: [...save.entries, { round: save.entries.length + 1, ticket: { picks: { ...save.draft.picks }, boost: save.draft.boost }, revealed: false }] }
}
export function revealTicket(save: PredictionSave): PredictionSave {
  const last = save.entries.at(-1)
  if (!last || last.revealed) throw new Error('There is no sealed ticket to reveal.')
  return { ...save, entries: save.entries.map((e, i) => i === save.entries.length - 1 ? { ...e, revealed: true } : e), draft: emptyTicket() }
}
export function parsePredictions(raw: string | null): PredictionSave | null {
  if (!raw || raw.length > 30000) return null
  try {
    const value = JSON.parse(raw) as PredictionSave
    if (value?.version !== 1 || typeof value.name !== 'string' || value.name.trim().length < 2 || value.name.trim().length > 24 || ticketError(value.draft, false) || !Array.isArray(value.entries) || value.entries.length > PREDICTION_ROUNDS) return null
    if (value.entries.some((e, i) => !e || e.round !== i + 1 || typeof e.revealed !== 'boolean' || (!e.revealed && i !== value.entries.length - 1) || ticketError(e.ticket))) return null
    const clean = (t: Ticket): Ticket => ({ picks: Object.fromEntries(CALLS.map(c => [c, t.picks[c]])) as Picks, boost: t.boost })
    return { version: 1, name: value.name.trim(), draft: clean(value.draft), entries: value.entries.map(e => ({ round: e.round, revealed: e.revealed, ticket: clean(e.ticket) })) }
  } catch { return null }
}
const HANDLES = ['Apex Oracle', 'Late Call', 'Sector Reader', 'Pole Theory', 'Box Office', 'Rain Check', 'The Overcut', 'Sunday Instinct', 'Grid Logic', 'Carbon Copy', 'Turn One', 'Podium Poet', 'Inside Line', 'Race Whisper', 'Last Word']
export function predictionStandings(save: PredictionSave, mode: 'season' | 'round' = 'season') {
  const completed = save.entries.filter(e => e.revealed)
  const selected = mode === 'round' ? completed.slice(-1) : completed
  const rows = [{ id: 'you', name: save.name }, ...HANDLES.map((name, i) => ({ id: `prediction-cpu-${i}`, name }))].map((player, i) => {
    const scores = selected.map(entry => scoreTicket(i === 0 ? entry.ticket : sampleTicket(entry.round + i * 100), predictionOutcome(entry.round)))
    return { ...player, points: scores.reduce((n, s) => n + s.total, 0), exact: scores.reduce((n, s) => n + s.exact, 0), races: selected.length, rank: 0 }
  }).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id))
  return rows.map(row => ({ ...row, rank: rows.findIndex(r => r.points === row.points) + 1 }))
}
