export const ROLES = ['leader', 'charger', 'rival'] as const
export type Role = typeof ROLES[number]
export type Lineup = Record<Role, string>
export interface FantasyDriver {
  id: string; first: string; surname: string; number: number; team: string; colour: string
  /** Tenths of a million. Integer arithmetic keeps budget validation exact. */
  price: number
}
export interface FantasyTeam { name: string; colour: string; lineup: Lineup }
export interface DriverResult {
  driverId: string; team: string; qualifying: number | null; grid: number | null
  finish: number | null; status: 'finished' | 'dnf' | 'dns' | 'dsq'
}
export interface ScoreLine { label: string; points: number }
export interface DriverScore { driverId: string; role: Role; base: number; bonus: number; total: number; lines: ScoreLine[] }
export interface SquadScore { total: number; bonus: number; leader: number; drivers: DriverScore[] }
export interface RoundEntry { round: number; lineup: Lineup }
export interface PracticeSave { version: 1; team: FantasyTeam; entries: RoundEntry[] }
export interface Competitor { id: string; name: string; colour: string; computer: boolean; lineup: Lineup }
export interface Standing extends Competitor { rank: number; total: number; last: number; scores: SquadScore[] }
export interface CupMatch {
  id: string; round: number; a: string | null; b: string | null
  scoreA: SquadScore | null; scoreB: SquadScore | null; winner: string | null; tiebreak: boolean
}
export interface Cup { number: number; seeds: string[]; stages: CupMatch[][]; champion: string | null }
