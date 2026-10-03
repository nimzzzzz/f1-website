'use client'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BUDGET, COLOURS, ROLE_INFO, SEASON_ROUNDS, assignDriver, lineupCost, money, scoreSquad, validateTeam } from '@/lib/fantasy/rules'
import { DEFAULT_SAVE, PRACTICE_DRIVERS, STORAGE_KEY, buildCup, competitors, currentCupNumber, nextMatch, parseSave, playRound, practiceResults, standings } from '@/lib/fantasy/practice'
import { ROLES, type FantasyTeam, type PracticeSave, type Role } from '@/lib/fantasy/types'
import DriverMarket, { DriverPortrait } from './DriverMarket'
import { Championship, Knockout, TeamMark } from './Competitions'
import FantasyDialog from './FantasyDialog'
import FantasyRules from './FantasyRules'
import RoleLab from './RoleLab'
import Link from 'next/link'

type View = 'garage' | 'championship' | 'cup'
const VIEWS: { id: View; label: string }[] = [{ id: 'garage', label: 'My garage' }, { id: 'championship', label: 'Championship' }, { id: 'cup', label: 'Knockout cup' }]

export default function FantasyClient() {
  const [save, setSave] = useState<PracticeSave>(DEFAULT_SAVE)
  const [draft, setDraft] = useState<FantasyTeam>(DEFAULT_SAVE.team)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>('garage')
  const [picker, setPicker] = useState<Role | null>(null)
  const [identity, setIdentity] = useState(false)
  const [rules, setRules] = useState(false)
  const [reset, setReset] = useState(false)
  const [debrief, setDebrief] = useState<number | null>(null)
  const [racing, setRacing] = useState(false)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const racingRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const stored = parseSave(raw)
      if (stored) { setSave(stored); setDraft(stored.team) }
      else if (raw) setStorageError('Your saved practice season could not be read. A fresh squad is shown; saving will replace the unreadable save.')
    } catch { setStorageError('Browser storage is unavailable. You can play, but this session will not be saved.') }
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const stored = parseSave(event.newValue)
      if (!stored) return
      if (timer.current) clearTimeout(timer.current)
      racingRef.current = false; setRacing(false); setDebrief(null); setPicker(null)
      setSave(stored); setDraft(stored.team); setNotice('Practice season updated from another tab.')
    }
    window.addEventListener('storage', sync)
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener('storage', sync) }
  }, [])

  const persist = (next: PracticeSave) => {
    setSave(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('Your changes could not be saved in this browser. Keep this tab open to continue playing.') }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(save.team)
  const teamError = validateTeam(draft, PRACTICE_DRIVERS)
  const cost = lineupCost(draft.lineup, PRACTICE_DRIVERS)
  const table = standings(save)
  const you = table.find(t => t.id === 'you')!
  const matchup = nextMatch(save)
  const cupNumber = currentCupNumber(save.entries.length)
  const cupsWon = Array.from({ length: Math.floor(save.entries.length / 4) }, (_, i) => buildCup(save, i + 1)).filter(c => c.champion === 'you').length
  const finished = save.entries.length >= SEASON_ROUNDS
  const nextRound = save.entries.length + 1
  const stageName = ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'][(nextRound - 1) % 4]

  function saveTeam() {
    if (teamError) { setNotice(teamError); return }
    const team = { ...draft, name: draft.name.trim() }
    persist({ ...save, team }); setDraft(team); setNotice('Squad saved. You are ready for the next practice race.')
  }
  function race() {
    if (!ready || racingRef.current || finished || dirty || teamError) return
    racingRef.current = true; setRacing(true); setNotice('The practice race is running. Your lineup is locked for this round.')
    timer.current = setTimeout(() => {
      const next = playRound(save)
      persist(next); setDebrief(next.entries.length); setRacing(false); racingRef.current = false
      setNotice(`Race ${next.entries.length} complete. Championship and cup updated.`)
    }, 1000)
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!offset && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? VIEWS.length - 1 : (index + offset + VIEWS.length) % VIEWS.length
    setView(VIEWS[next].id)
    document.getElementById(`fantasy-tab-${VIEWS[next].id}`)?.focus()
  }

  return <div className="fantasy" style={{ '--fantasy-accent': draft.colour } as CSSProperties}>
    <div className="fantasy-statusbar"><span>LIGHTS OUT FANTASY</span><span>Practice mode <span className="fantasy-statusbar-detail"> / Computer opponents</span></span><button onClick={() => setRules(true)}>How to play <span aria-hidden>↗</span></button></div>
    <header className="fantasy-hero">
      <div className="fantasy-hero-copy"><p className="fantasy-kicker">You are the team principal</p><h1>YOUR TEAM.<br /><span>YOUR CALL.</span></h1><p>Three drivers. Three roles. A season to own.</p></div>
      <div className="fantasy-identity"><TeamMark name={draft.name} colour={draft.colour} /><div><span className="fantasy-kicker">Your constructor</span><h2>{draft.name || 'Your team'}</h2><button className="fantasy-text-button" onClick={() => setIdentity(true)} disabled={racing || !ready}>Edit team identity <span aria-hidden>↗</span></button></div><div className="fantasy-identity-stats"><span>Season points<strong>{you.total}</strong></span><span>Cup trophies<strong>{cupsWon.toString().padStart(2, '0')}</strong></span></div></div>
    </header>

    <div className="fantasy-workspace">
      <div className="fantasy-tabs" role="tablist" aria-label="Fantasy competitions">{VIEWS.map((v, i) => <button key={v.id} id={`fantasy-tab-${v.id}`} role="tab" aria-selected={view === v.id} aria-controls={view === v.id ? `fantasy-panel-${v.id}` : undefined} tabIndex={view === v.id ? 0 : -1} onKeyDown={e => tabKey(e, i)} onClick={() => setView(v.id)}>{v.label}{v.id === 'cup' && <span aria-hidden>{String(cupNumber).padStart(2, '0')}</span>}</button>)}</div>
      <div className="fantasy-practice-note"><span>Practice season</span><p>Simulated races and opponents. Progress stays in this browser. Shared competitions are not open yet.</p></div>
      {storageError && <p role="alert" className="fantasy-storage-error">{storageError}</p>}
      <p className="fantasy-announcement" role="status" aria-live="polite">{notice}</p>

      <div role="tabpanel" id={`fantasy-panel-${view}`} aria-labelledby={`fantasy-tab-${view}`} key={view} className="fantasy-panel" tabIndex={0}>
        {view === 'garage' && <>
          <div className="fantasy-garage-heading"><div><span className="fantasy-kicker">{finished ? 'Season complete' : `Ready for practice race ${String(nextRound).padStart(2, '0')}`}</span><h2>ASSEMBLE YOUR ADVANTAGE.</h2></div><div className="fantasy-budget"><span>Budget remaining</span><strong>{money(BUDGET - cost)}</strong><small>{money(cost)} of {money(BUDGET)} spent</small></div></div>
          <div className="fantasy-squad" aria-label="Your three driver roles">
            {ROLES.map((role, index) => {
              const driver = PRACTICE_DRIVERS.find(d => d.id === draft.lineup[role])!
              return <article key={role} className={`fantasy-driver fantasy-driver--${role}`} style={{ '--driver-colour': driver.colour, '--arrival': `${index * 80}ms` } as CSSProperties}>
                <div className="fantasy-driver-top"><span>{ROLE_INFO[role].name}</span><strong>{money(driver.price)}</strong></div>
                <button className="fantasy-driver-pick" aria-label={`Change ${ROLE_INFO[role].name}: ${driver.first} ${driver.surname}`} onClick={() => setPicker(role)} disabled={!ready || racing || finished}>
                  <span className="fantasy-driver-number" aria-hidden>{driver.number}</span><DriverPortrait key={driver.id} driver={driver} priority />
                  <span className="fantasy-driver-copy"><small>{driver.first}</small><strong>{driver.surname}</strong><span>{driver.team}</span></span>
                  <span className="fantasy-driver-change" aria-hidden>↔</span>
                </button>
                <div className="fantasy-driver-role"><span>{ROLE_INFO[role].short}</span><p>{ROLE_INFO[role].rule}</p></div>
              </article>
            })}
          </div>
          <div className="fantasy-garage-actions"><p>{!ready ? 'Loading your garage…' : finished ? 'Your practice season is complete. Explore your results or start again.' : dirty ? 'Unsaved changes. Save your squad before the next race.' : 'Squad ready. Changes apply to your next race only.'}</p><div><button className="fantasy-button fantasy-button--secondary" onClick={saveTeam} disabled={!ready || racing || !dirty || Boolean(teamError) || finished}>Save squad</button><button className="fantasy-button" onClick={race} disabled={!ready || racing || finished || dirty || Boolean(teamError)}>{racing ? 'Lights out…' : 'Run practice race'}<span aria-hidden>↗</span></button></div></div>
          {racing && <div className="fantasy-start-lights" aria-hidden>{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--light': `${i * 140}ms` } as CSSProperties} />)}</div>}

          <section className="fantasy-duel" aria-labelledby="fantasy-duel-title">
            <div className="fantasy-duel-header"><div><span className="fantasy-kicker">{finished ? 'Season complete' : matchup?.consolation ? 'Consolation matchup' : `Cup ${String(cupNumber).padStart(2, '0')} / ${stageName}`}</span><h2 id="fantasy-duel-title">{finished ? 'THE SEASON IS YOURS TO REVIEW.' : 'ONE WEEKEND. ONE RIVAL.'}</h2></div><button className="fantasy-text-button" onClick={() => setView('cup')}>Explore the bracket ↗</button></div>
            {matchup ? <div className="fantasy-faceoff"><div><TeamMark name={save.team.name} colour={save.team.colour} /><span className="fantasy-kicker">Your team</span><h3>{save.team.name}</h3><p>{you.total} season points</p></div><div className="fantasy-versus"><span>VS</span><small>Race {String(nextRound).padStart(2, '0')}</small></div><div><TeamMark name={matchup.opponent.name} colour={matchup.opponent.colour} /><span className="fantasy-kicker">Computer opponent</span><h3>{matchup.opponent.name}</h3><p>{table.find(t => t.id === matchup.opponent.id)?.total ?? 0} season points</p></div></div> : <div className="fantasy-season-finish"><strong>{you.rank === 1 ? 'CHAMPIONSHIP WINNER' : `P${you.rank} IN THE CHAMPIONSHIP`}</strong><p>{you.total} points across 24 races. {cupsWon} cup {cupsWon === 1 ? 'trophy' : 'trophies'} for your garage.</p><button className="fantasy-button" onClick={() => setView('championship')}>See final standings ↗</button></div>}
            {matchup && <p className="fantasy-duel-footer">{matchup.consolation ? 'You are out of this cup. Keep racing for season points; a fresh cup starts after the final.' : 'Your saved squad scores in both competitions. The higher score advances.'}</p>}
          </section>
          {save.entries.length > 0 && <section className="fantasy-history"><div><h2>YOUR SEASON, RACE BY RACE.</h2><p>Revisit the decisions behind every point.</p></div><div className="fantasy-history-list">{you.scores.map((score, i) => <button key={i} onClick={() => setDebrief(i + 1)}><span>Race {String(i + 1).padStart(2, '0')}</span><strong>{score.total}<small> pts</small></strong><span>Debrief ↗</span></button>)}</div></section>}
        </>}
        {view === 'championship' && <Championship save={save} />}
        {view === 'cup' && <Knockout save={save} />}
      </div>
      <footer className="fantasy-footer"><Link href="/predictions">Make your weekend calls in Predictions ↗</Link><button onClick={() => setReset(true)} disabled={!ready || racing}>Restart practice season</button></footer>
    </div>

    {picker && <DriverMarket role={picker} lineup={draft.lineup} onClose={() => setPicker(null)} onChoose={id => { setDraft({ ...draft, lineup: assignDriver(draft.lineup, picker, id) }); setPicker(null); setNotice('Driver roles updated. Save your squad to confirm.') }} />}
    {identity && <TeamIdentity team={draft} onClose={() => setIdentity(false)} onSave={team => { setDraft(team); setIdentity(false); setNotice('Team identity updated. Save your squad to keep it.') }} />}
    {rules && <FantasyRules onClose={() => setRules(false)} />}
    {reset && <FantasyDialog title="A fresh start?" onClose={() => setReset(false)}><p className="fantasy-dialog-copy">This replaces your local practice scores and cup history. Your team name, colours and saved lineup stay.</p><div className="fantasy-dialog-actions"><button className="fantasy-button fantasy-button--secondary" onClick={() => setReset(false)}>Keep my season</button><button className="fantasy-button" onClick={() => { persist({ ...save, entries: [] }); setDraft(save.team); setReset(false); setDebrief(null); setView('garage'); setNotice('A new practice season is ready.') }}>Restart season</button></div></FantasyDialog>}
    {debrief !== null && save.entries[debrief - 1] && <RaceDebrief key={debrief} save={save} round={debrief} onClose={() => setDebrief(null)} />}
  </div>
}

function TeamIdentity({ team, onClose, onSave }: { team: FantasyTeam; onClose: () => void; onSave: (team: FantasyTeam) => void }) {
  const [name, setName] = useState(team.name)
  const [colour, setColour] = useState(team.colour)
  return <FantasyDialog title="Make it your team" onClose={onClose}>
    <form className="fantasy-identity-form" onSubmit={e => { e.preventDefault(); if (name.trim().length >= 2) onSave({ ...team, name: name.trim(), colour }) }}>
      <div className="fantasy-mark-preview"><TeamMark name={name} colour={colour} /></div>
      <label>Team name<input autoFocus required minLength={2} maxLength={28} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
      <fieldset><legend>Team colour</legend><div className="fantasy-colours">{COLOURS.map(c => <label key={c.value} style={{ '--swatch': c.value } as CSSProperties}><input type="radio" name="team-colour" value={c.value} checked={colour === c.value} onChange={() => setColour(c.value)} /><span aria-hidden /><span className="sr-only">{c.name}</span></label>)}</div></fieldset>
      <button className="fantasy-button" type="submit" disabled={name.trim().length < 2}>Use this identity ↗</button>
    </form>
  </FantasyDialog>
}

function RaceDebrief({ save, round, onClose }: { save: PracticeSave; round: number; onClose: () => void }) {
  const entry = save.entries[round - 1]
  const results = practiceResults(round)
  const score = scoreSquad(entry.lineup, results)
  const before = { ...save, entries: save.entries.slice(0, round - 1) }
  const match = nextMatch(before)
  const cup = buildCup(save, Math.ceil(round / 4))
  const playedMatch = cup.stages.flat().find(m => m.round === round && (m.a === 'you' || m.b === 'you'))
  const opposition = match ? scoreSquad(match.opponent.lineup, results) : null
  const won = playedMatch ? playedMatch.winner === 'you' : opposition ? score.total > opposition.total : false
  const tied = !playedMatch && opposition?.total === score.total
  const teams = competitors(save)
  const isFinal = round % 4 === 0
  return <FantasyDialog title={`Race ${String(round).padStart(2, '0')} debrief`} onClose={onClose} wide>
    <p className="fantasy-dialog-copy">Simulated practice results. These are not real Grand Prix results.</p>
    <div className="fantasy-debrief-score"><div><span>Your weekend</span><strong>{score.total}<small>PTS</small></strong></div><div><span>From role bonuses</span><strong>+{score.bonus}</strong></div></div>
    {match && <div className="fantasy-debrief-verdict"><strong>{tied ? 'MATCH DRAWN' : won ? playedMatch && isFinal ? 'CUP WINNER' : 'MATCH WON' : 'MATCH LOST'}</strong><p>{save.team.name} {score.total} : {opposition?.total} {match.opponent.name}{match.consolation ? ' (consolation)' : ''}.{playedMatch?.tiebreak ? ' Decided on the published tiebreak rules.' : ''}</p><p>{playedMatch && !won ? 'Your championship continues. A fresh cup starts after the final.' : playedMatch && won && !isFinal ? 'You advance to the next round.' : 'Every point stays in your season total.'}</p></div>}
    <div className="fantasy-debrief-drivers">{score.drivers.map(d => {
      const driver = PRACTICE_DRIVERS.find(p => p.id === d.driverId)!
      const result = results.find(r => r.driverId === d.driverId)!
      return <div key={d.role}><span className="fantasy-kicker">{ROLE_INFO[d.role].name}</span><h3>{driver.surname}<strong>{d.total}</strong></h3><p className="fantasy-result-line">Qualified P{result.qualifying} / {result.status === 'finished' ? `Finished P${result.finish}` : 'DNF'}</p><dl>{d.lines.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{line.points > 0 ? '+' : ''}{line.points}</dd></div>)}</dl></div>
    })}</div>
    <RoleLab lineup={entry.lineup} results={results} />
    {isFinal && cup.champion && <p className="fantasy-notice">Cup {cup.number} winner: {teams.find(t => t.id === cup.champion)?.name}. {round < SEASON_ROUNDS ? 'All teams enter a new cup for the next race.' : 'The practice season is complete.'}</p>}
    <div className="fantasy-dialog-actions"><button className="fantasy-button" onClick={onClose}>Back to the garage ↗</button></div>
  </FantasyDialog>
}
