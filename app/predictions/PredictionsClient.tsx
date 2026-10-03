'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import GameDialog from '@/components/games/GameDialog'
import { CALLS, CALL_INFO, INITIAL_PREDICTIONS, PREDICTION_ROUNDS, PREDICTION_STORAGE, emptyTicket, parsePredictions, pickLabel, potentialPoints, predictionOutcome, revealTicket, sampleTicket, scoreTicket, sealTicket, setPick, ticketError, type Call, type DriverCall, type PredictionSave, type Ticket } from '@/lib/predictions/game'
import PredictionPicker, { PredictionPortrait } from './PredictionPicker'
import PredictionResults from './PredictionResults'
import PredictionStandings from './PredictionStandings'

type View = 'calls' | 'leaderboard' | 'history'
const VIEWS: { id: View; name: string }[] = [{ id: 'calls', name: 'My calls' }, { id: 'leaderboard', name: 'Leaderboard' }, { id: 'history', name: 'Past weekends' }]

export default function PredictionsClient() {
  const [save, setSave] = useState<PredictionSave>(INITIAL_PREDICTIONS)
  const [ready, setReady] = useState(false)
  const saveRef = useRef(save)
  const [view, setView] = useState<View>('calls')
  const [picker, setPicker] = useState<DriverCall | null>(null)
  const [rules, setRules] = useState(false)
  const [reset, setReset] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [resultRound, setResultRound] = useState<number | null>(null)
  const [revealing, setRevealing] = useState(false)
  const revealRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREDICTION_STORAGE)
      const stored = parsePredictions(raw)
      if (stored) { saveRef.current = stored; setSave(stored) }
      else if (raw) setStorageError('Your saved predictions could not be read. A fresh ticket is shown; your next change will replace the unreadable save.')
    } catch { setStorageError('Browser storage is unavailable. You can play, but this session will not be saved.') }
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key !== PREDICTION_STORAGE) return
      const stored = parsePredictions(event.newValue)
      if (!stored) return
      if (timer.current) clearTimeout(timer.current)
      revealRef.current = false; setRevealing(false); setPicker(null); setResultRound(null)
      saveRef.current = stored; setSave(stored); setNotice('Predictions updated from another tab.')
    }
    window.addEventListener('storage', sync)
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener('storage', sync) }
  }, [])

  function commit(next: PredictionSave) {
    saveRef.current = next; setSave(next)
    try { localStorage.setItem(PREDICTION_STORAGE, JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('Your progress could not be saved. Keep this tab open to continue playing.') }
  }
  const completed = save.entries.filter(e => e.revealed)
  const pending = save.entries.at(-1)?.revealed === false ? save.entries.at(-1)! : null
  const ticket = pending?.ticket ?? save.draft
  const round = Math.min(completed.length + 1, PREDICTION_ROUNDS)
  const finished = completed.length >= PREDICTION_ROUNDS
  const locked = Boolean(pending) || finished || !ready || revealing
  const selected = CALLS.filter(c => ticket.picks[c] !== null).length
  const scores = completed.map(e => scoreTicket(e.ticket, predictionOutcome(e.round)))
  const total = scores.reduce((n, s) => n + s.total, 0)
  const hits = scores.reduce((n, s) => n + s.exact, 0)
  const best = Math.max(0, ...scores.map(s => s.total))
  const error = ticketError(ticket)
  const resultEntry = save.entries.find(e => e.round === resultRound && e.revealed)

  function change(next: Ticket) {
    if (locked) return
    commit({ ...saveRef.current, draft: next })
  }
  function seal() {
    if (!ready || revealRef.current) return
    try { commit(sealTicket(saveRef.current)); setNotice('Ticket sealed. Your calls are locked for this practice weekend.') }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Check your ticket and try again.') }
  }
  function reveal() {
    if (!pending || revealRef.current) return
    revealRef.current = true; setRevealing(true)
    timer.current = setTimeout(() => {
      const next = revealTicket(saveRef.current)
      commit(next); setResultRound(next.entries.length); setRevealing(false); revealRef.current = false
      setNotice(`Weekend ${next.entries.length} scored. Your Predictions leaderboard is updated.`)
    }, 850)
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3
    setView(VIEWS[next].id); document.getElementById(`predictions-tab-${VIEWS[next].id}`)?.focus()
  }
  const boost = (call: Call) => change({ ...ticket, boost: call })

  return <div className="predictions">
    <div className="predictions-topline"><span>LIGHTS OUT / PREDICTIONS</span><button onClick={() => setRules(true)}>The rules ↗</button></div>
    <header className="predictions-hero"><div><p className="predictions-label">For the ones who saw it coming</p><h1>I CALLED <span>IT.</span></h1><p>Pick the podium. Back your instinct. Make the weekend yours.</p></div><div className="predictions-record"><span>Your Predictions record</span><div><p><strong>{total}</strong><span>Season points</span></p><p><strong>{hits}<small>/{completed.length * 6}</small></strong><span>Exact calls</span></p><p><strong>{best}</strong><span>Best weekend</span></p></div></div></header>
    <div className="predictions-workspace">
      <div className="predictions-navigation"><div role="tablist" aria-label="Predictions game">{VIEWS.map((v, i) => <button key={v.id} id={`predictions-tab-${v.id}`} role="tab" aria-selected={view === v.id} aria-controls={view === v.id ? `predictions-panel-${v.id}` : undefined} tabIndex={view === v.id ? 0 : -1} onKeyDown={e => onTabKey(e, i)} onClick={() => setView(v.id)}>{v.name}</button>)}</div><span>Practice / {PREDICTION_ROUNDS} weekends</span></div>
      <p className="predictions-practice-note">Practice mode: simulated results and computer opponents. Saved in this browser. Shared play is not connected yet.</p>
      {storageError && <p role="alert" className="predictions-storage-error">{storageError}</p>}
      <p className="predictions-announcement" role="status">{notice}</p>
      <div role="tabpanel" tabIndex={0} id={`predictions-panel-${view}`} aria-labelledby={`predictions-tab-${view}`}>
        {view === 'calls' && (finished ? <div className="predictions-season-end"><span className="predictions-label">24 weekends in the books</span><h2>YOU MADE YOUR CALLS.</h2><p>{total} points. {hits} exact predictions. Every ticket is in your weekend archive.</p><button className="predictions-button" onClick={() => setView('leaderboard')}>See final standings ↗</button></div> : <div className="predictions-play-grid">
          <section className="predictions-calls" aria-labelledby="predictions-weekend-title">
            <div className="predictions-weekend-heading"><div><span className="predictions-label">Practice weekend {String(round).padStart(2, '0')}</span><h2 id="predictions-weekend-title">{pending ? 'YOUR CALLS ARE IN.' : 'SIX CALLS. NO HINDSIGHT.'}</h2></div>{!pending && <button className="predictions-text-button" disabled={!ready} onClick={() => { change(sampleTicket(round)); setNotice('Sample picks filled. Change any answer before sealing.') }}>Try a sample ticket ↗</button>}</div>
            <div className="predictions-pole-row"><CallCard call="pole" ticket={ticket} locked={locked} onChoose={setPicker} onBoost={boost} /><div className="predictions-pole-copy"><span>Saturday sets the tone.</span><p>Call the fastest qualifier before anyone takes the track.</p></div></div>
            <div className="predictions-podium-heading"><h3>Your Sunday podium</h3><span>5 pts if on the podium in another place</span></div>
            <div className="predictions-podium">{(['first', 'second', 'third'] as const).map(call => <CallCard key={call} call={call} ticket={ticket} locked={locked} onChoose={setPicker} onBoost={boost} />)}</div>
            <div className="predictions-wildcards"><CallCard call="mover" ticket={ticket} locked={locked} onChoose={setPicker} onBoost={boost} /><article className={`prediction-call prediction-call--safety${ticket.boost === 'safety' ? ' is-boosted' : ''}`}><div className="prediction-call-label"><h3>Safety car</h3><span>5 PTS</span></div><p>Will a full safety car be deployed?</p><div className="predictions-safety-toggle" role="group" aria-label="Safety car prediction">{(['yes', 'no'] as const).map(answer => <button key={answer} aria-pressed={ticket.picks.safety === answer} disabled={locked} onClick={() => change({ ...ticket, picks: { ...ticket.picks, safety: answer } })}>{answer === 'yes' ? 'Yes' : 'No'}</button>)}</div><p className="predictions-safety-note">Virtual safety cars do not count.</p><button className="predictions-boost" aria-pressed={ticket.boost === 'safety'} disabled={locked || ticket.picks.safety === null} onClick={() => boost('safety')}>{ticket.boost === 'safety' ? '×2 Confidence pick' : 'Use ×2 boost here'}</button></article></div>
          </section>
          <aside className={`predictions-ticket${pending ? ' is-sealed' : ''}`} aria-label="Your prediction ticket">
            <div className="predictions-ticket-top"><span>Your call sheet</span><strong>{String(round).padStart(2, '0')}</strong></div>
            <div className="predictions-ticket-body"><div className="predictions-ticket-progress"><strong>{selected}<span>/6</span></strong><span>Calls made</span></div>
              <ol>{CALLS.map(call => <li key={call}><span>{CALL_INFO[call].label}</span><strong>{pickLabel(ticket.picks[call])}{ticket.boost === call && <b>×2</b>}</strong></li>)}</ol>
              <div className="predictions-confidence-note"><span>One confidence boost</span><p>{ticket.boost ? `Backing your ${CALL_INFO[ticket.boost].label.toLowerCase()} call for double points.` : 'Back one call. Earn double its points if it lands.'}</p></div>
              <div className="predictions-potential"><span>Points possible</span><strong>{potentialPoints(ticket)}</strong></div>
            </div>
            <div className="predictions-ticket-bottom">{pending ? <><span className="predictions-seal">SEALED</span><p>Your picks are locked. Reveal the simulated weekend when you are ready.</p><button className="predictions-button" onClick={reveal} disabled={revealing}>{revealing ? 'Revealing the weekend…' : 'Reveal practice results'}<span aria-hidden>↗</span></button></> : <><button className="predictions-button" onClick={seal} disabled={!ready || Boolean(error)}>Seal my picks <span aria-hidden>↗</span></button><p>{error ?? 'Ready to seal. Your calls cannot be edited afterwards.'}</p><span className="predictions-autosave">{ready ? storageError ? 'Session only' : 'Draft saved on this device' : 'Loading your ticket…'}</span></>}</div>
          </aside>
        </div>)}
        {view === 'leaderboard' && <PredictionStandings save={save} onName={() => { setNameDraft(save.name); setEditName(true) }} />}
        {view === 'history' && <section className="predictions-history"><div className="predictions-section-heading"><p className="predictions-label">Your weekend archive</p><h2>THE RECEIPTS ARE HERE.</h2><p>Every sealed call. Every point explained.</p></div>{completed.length === 0 ? <div className="predictions-history-empty"><span>NO RECEIPTS. YET.</span><p>Seal a ticket and reveal your first practice weekend to start the archive.</p><button className="predictions-button" onClick={() => setView('calls')}>Make your calls ↗</button></div> : <div className="predictions-history-grid">{[...completed].reverse().map(entry => { const score = scoreTicket(entry.ticket, predictionOutcome(entry.round)); return <button key={entry.round} className="predictions-receipt" onClick={() => setResultRound(entry.round)}><span>Weekend {String(entry.round).padStart(2, '0')}</span><strong>{score.total}<small>PTS</small></strong><p>{score.exact} of 6 called exactly</p><div><span>Boost +{score.bonus}</span><span>Open receipt ↗</span></div></button> })}</div>}</section>}
      </div>
      <footer className="predictions-footer"><Link href="/fantasy">Build a team in Fantasy ↗</Link><button onClick={() => setReset(true)} disabled={!ready || revealing}>Restart prediction practice</button></footer>
    </div>
    {picker && !locked && <PredictionPicker call={picker} ticket={ticket} onClose={() => setPicker(null)} onPick={id => { change(setPick(ticket, picker, id)); setNotice(`${pickLabel(id)} selected for ${CALL_INFO[picker].label.toLowerCase()}.`); setPicker(null) }} />}
    {resultEntry && <PredictionResults entry={resultEntry} onClose={() => setResultRound(null)} />}
    {rules && <PredictionRules onClose={() => setRules(false)} />}
    {reset && <GameDialog title="Start a fresh prediction season?" onClose={() => setReset(false)} className="predictions-dialog"><p className="predictions-dialog-copy">This replaces your local prediction tickets and scores. Your display name stays. Fantasy progress is separate.</p><div className="predictions-dialog-actions"><button className="predictions-button predictions-button--secondary" onClick={() => setReset(false)}>Keep my season</button><button className="predictions-button" onClick={() => { commit({ ...INITIAL_PREDICTIONS, name: save.name, draft: emptyTicket(), entries: [] }); setReset(false); setResultRound(null); setView('calls'); setNotice('A fresh prediction season is ready.') }}>Restart practice</button></div></GameDialog>}
    {editName && <GameDialog title="Your name on the board" onClose={() => setEditName(false)} className="predictions-dialog"><form className="predictions-name-form" onSubmit={e => { e.preventDefault(); if (nameDraft.trim().length < 2) return; commit({ ...save, name: nameDraft.trim() }); setEditName(false) }}><label>Display name<input required minLength={2} maxLength={24} autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} /></label><button className="predictions-button" disabled={nameDraft.trim().length < 2}>Save display name</button></form></GameDialog>}
  </div>
}

function CallCard({ call, ticket, locked, onChoose, onBoost }: { call: DriverCall; ticket: Ticket; locked: boolean; onChoose: (call: DriverCall) => void; onBoost: (call: Call) => void }) {
  const id = ticket.picks[call]
  const number = { pole: 'POLE', first: '01', second: '02', third: '03', mover: '↑' }[call]
  return <article className={`prediction-call prediction-call--${call}${ticket.boost === call ? ' is-boosted' : ''}${id ? ' has-pick' : ''}`}>
    <div className="prediction-call-label"><h3>{CALL_INFO[call].label}</h3><span>{CALL_INFO[call].points} PTS</span></div>
    <button className="prediction-call-select" disabled={locked} aria-label={`${CALL_INFO[call].label}: ${id ? pickLabel(id) : 'choose driver'}`} onClick={() => onChoose(call)}>
      <span className="prediction-position" aria-hidden>{number}</span>{id && <PredictionPortrait key={id} id={id} eager />}
      <span className="prediction-picked-name">{id ? <><strong>{pickLabel(id)}</strong><small>{locked ? 'Your call' : 'Change driver ↔'}</small></> : <><span className="prediction-add" aria-hidden>+</span><strong>Make the call</strong></>}</span>
    </button>
    <button className="predictions-boost" aria-pressed={ticket.boost === call} disabled={locked || !id} onClick={() => onBoost(call)}>{ticket.boost === call ? '×2 Confidence pick' : 'Use ×2 boost here'}</button>
  </article>
}

function PredictionRules({ onClose }: { onClose: () => void }) {
  return <GameDialog title="Make the call. Know the rules." onClose={onClose} className="predictions-dialog"><div className="predictions-rules">
    <section><h3>Six calls per weekend</h3><p>Pole position (10), race winner (25), second place (15), third place (15), biggest mover (10) and full safety car, yes or no (5). Pick three different podium drivers. Pole and biggest mover may also be podium picks.</p></section>
    <section><h3>Close still counts</h3><p>A podium driver in the wrong predicted place earns 5 points instead of the exact-position award. Incorrect calls earn 0. Equal largest position gains count for every tied driver; only finishers qualify. Pole means Grand Prix qualifying, not the final starting grid. VSC alone does not count as a full safety car.</p></section>
    <section><h3>One confidence pick</h3><p>Choose one answer to earn double its points. A partial podium award doubles too. A miss stays at 0. A perfect ticket is worth 80 points before the boost, or up to 105 with the winner boosted.</p></section>
    <section><h3>Seal. Reveal. Repeat.</h3><p>Drafts save automatically on this device. Sealing makes that weekend's picks final. Reveal the practice result to score the ticket and open the next weekend. The season has 24 practice weekends. Equal point totals share a leaderboard rank.</p></section>
    <section><h3>A separate championship</h3><p>Prediction points and history are separate from Fantasy. This first build uses fictional races and 15 computer opponents. There are no real race deadlines or shared accounts yet; browser storage is practice progress only.</p></section>
  </div></GameDialog>
}
