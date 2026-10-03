'use client'

import { CALL_INFO, pickLabel, predictionOutcome, scoreTicket, type Entry } from '@/lib/predictions/game'
import GameDialog from '@/components/games/GameDialog'
import { PredictionPortrait } from './PredictionPicker'

export default function PredictionResults({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const outcome = predictionOutcome(entry.round)
  const score = scoreTicket(entry.ticket, outcome)
  return <GameDialog title={`Weekend ${String(entry.round).padStart(2, '0')}: the verdict`} onClose={onClose} className="predictions-dialog predictions-dialog--wide">
    <p className="predictions-dialog-copy">Simulated practice results. Each call is scored against the same result for every player.</p>
    <div className="predictions-verdict"><div><span>YOUR SCORE</span><strong>{score.total}<small>PTS</small></strong></div><div><span>EXACT CALLS</span><strong>{score.exact}<small>/ 6</small></strong></div><div><span>CONFIDENCE BONUS</span><strong>+{score.bonus}</strong></div></div>
    <div className="predictions-actual-podium">{outcome.podium.map((id, i) => <div key={id}><PredictionPortrait id={id} eager /><span>P{i + 1}</span><strong>{pickLabel(id)}</strong></div>)}</div>
    <div className="predictions-scoring-list">{score.calls.map(call => <div key={call.call} className={`predictions-scored-call is-${call.verdict}`}><div><span>{CALL_INFO[call.call].label}{entry.ticket.boost === call.call && <b>×2</b>}</span><strong>{pickLabel(call.picked)}</strong><small>Result: {call.actual}</small></div><div><span>{call.verdict === 'exact' ? 'Called it' : call.verdict === 'partial' ? 'Podium, different place' : 'Missed'}</span><strong>+{call.total}</strong>{call.bonus > 0 && <small>{call.base} + {call.bonus} boost</small>}</div></div>)}</div>
    <p className="predictions-result-note">These points count only towards Predictions. Your Fantasy championship stays separate.</p>
    <button className="predictions-button" onClick={onClose}>Back to my calls ↗</button>
  </GameDialog>
}
