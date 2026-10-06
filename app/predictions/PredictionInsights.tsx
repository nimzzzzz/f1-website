'use client'
import { predictionInsights } from '@/lib/predictions/insights'
import type { PredictionSave } from '@/lib/predictions/game'

export default function PredictionInsights({ save }: { save: PredictionSave }) {
  const form = predictionInsights(save)
  return <section className="prediction-insights">
    <div className="predictions-section-heading"><p className="predictions-label">Your instinct, on the record</p><h2>KNOW YOUR <em>EDGE.</em></h2><p>Exact calls measure accuracy. Close podium calls still earn points, but do not count as exact.</p></div>
    <div className="prediction-form-record"><div><span>Current streak</span><strong>{form.currentStreak}<small> weekends</small></strong><p>At least one exact call in each weekend.</p></div><div><span>Longest streak</span><strong>{form.longestStreak}<small> weekends</small></strong><p>Your best uninterrupted run.</p></div><div><span>Confidence paid off</span><strong>{form.boostPaid}<small> / {form.weekends.length}</small></strong><p>+{form.boostPoints} points earned by your boosts.</p></div></div>
    {!form.weekends.length && <p className="predictions-notice">Reveal your first practice weekend to start your accuracy record.</p>}
    <div className="prediction-accuracy">{form.categories.map((c, i) => <article key={c.call}><div><span className="predictions-label">0{i + 1} / {c.label}</span><strong>{c.percent === null ? '—' : `${c.percent}%`}</strong></div><div className="prediction-accuracy-track" aria-hidden><span style={{ width: `${c.percent ?? 0}%` }} /></div><p>{c.exact} / {c.attempts} exact{c.partial ? ` · ${c.partial} partial` : ''}<span>{c.points} PTS</span></p><small>Best exact-call streak: {c.longest}</small></article>)}</div>
    <div className="prediction-milestones"><h3>INSTINCT EARNS ITS STRIPES.</h3><p>Milestones celebrate your record. They do not change your points.</p><div>{form.milestones.map((m, i) => <article key={m.name} className={m.round ? 'is-earned' : ''}><span aria-hidden>{String(i + 1).padStart(2, '0')}</span><h4>{m.name}</h4><p>{m.description}</p><small>{m.round ? `Earned · weekend ${m.round}` : 'Still to call'}</small></article>)}</div></div>
  </section>
}
