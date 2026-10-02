import type { Stint } from '@/lib/openf1'
import { pitTyres, type PitVisit } from '@/lib/pit-story'

function Compound({ name }: { name: string }) {
  const known = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(name)
  return <span className="pit-compound"><i className={known ? `pit-compound--${name.toLowerCase()}` : ''} aria-hidden>{known ? name[0] : '?'}</i><span>{known ? name : 'UNKNOWN'}</span></span>
}
export default function PitTyres({ visit, stints }: { visit: PitVisit; stints: Stint[] | null }) {
  const tyres = pitTyres(visit, stints)
  return tyres ? <span className="pit-tyres" aria-label={`Tyres: ${tyres.before.compound} to ${tyres.after.compound}`}>
    <Compound name={tyres.before.compound.toUpperCase()} /><span aria-hidden>→</span><Compound name={tyres.after.compound.toUpperCase()} />
  </span> : <span className="pit-tyres-unknown">Tyre change unavailable</span>
}
