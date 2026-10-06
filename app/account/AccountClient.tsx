'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { parseSave, STORAGE_KEY } from '@/lib/fantasy/practice'
import { parsePredictions, PREDICTION_STORAGE } from '@/lib/predictions/game'

type CloudSave = { game: 'fantasy' | 'predictions'; data: unknown; revision: number; updated_at: string }
export default function AccountClient() {
  const [profile, setProfile] = useState<{name:string; email:string} | null>(null), [name, setName] = useState('')
  const [saves, setSaves] = useState<CloudSave[] | null>(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState<string | null>(null)
  const request = async (url: string, body?: unknown) => {
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Please try again.'); return data
  }
  const refresh = useCallback(async () => {
    try { const [p, s] = await Promise.all([request('/api/account/profile'), request('/api/account/save')]); setProfile(p); setName(p.name); setSaves(s.saves) }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Account unavailable. Please retry.') }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  async function upload(game: CloudSave['game']) {
    setBusy(true); setNotice('')
    try {
      const parse = game === 'fantasy' ? parseSave : parsePredictions
      const data = parse(localStorage.getItem(game === 'fantasy' ? STORAGE_KEY : PREDICTION_STORAGE))
      if (!data) throw new Error('Play a practice weekend on this device first, then save it here.')
      await request('/api/account/save', { game, data, revision: saves?.find(s => s.game === game)?.revision ?? 0 })
      await refresh(); setNotice(`${game === 'fantasy' ? 'Fantasy' : 'Predictions'} saved to your account.`)
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Save failed. Please retry.') } finally { setBusy(false) }
  }
  function download(save: CloudSave) {
    try {
      const data = (save.game === 'fantasy' ? parseSave : parsePredictions)(JSON.stringify(save.data))
      if (!data) throw new Error('Your cloud save could not be read. Your device progress is unchanged.')
      const key = save.game === 'fantasy' ? STORAGE_KEY : PREDICTION_STORAGE
      const previous = localStorage.getItem(key)
      if (previous) localStorage.setItem(`${key}:before-cloud-restore`, previous)
      localStorage.setItem(key, JSON.stringify(data)); setRestore(null); setNotice('Cloud progress restored to this device. Open the game to continue. The previous device save is backed up.')
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Restore failed. Your device storage may be full.') }
  }
  return <div className="member-page"><header><span className="member-eyebrow">LIGHTS OUT / YOUR PADDOCK</span><h1>YOUR NAME.<br /><em>YOUR LEGACY.</em></h1><p>Two games. One home for your progress.</p></header>
    <p role="status" className="member-notice">{notice}</p>
    {!profile && <button className="member-button" onClick={refresh}>Reload account</button>}
    {profile && <section className="member-profile"><div><h2>ON THE GRID AS</h2><p>{profile.email}</p><small>Your email is private. Your display name is visible to other players.</small></div><form onSubmit={async e => { e.preventDefault(); setBusy(true); try { await request('/api/account/profile', { name }); setProfile({ ...profile, name }); setNotice('Display name saved.') } catch (e) { setNotice(e instanceof Error ? e.message : 'Please retry.') } finally { setBusy(false) } }}><label>Display name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={24} /></label><button className="member-button" disabled={busy}>Save name ↗</button></form></section>}
    <div className="member-games">{(['fantasy', 'predictions'] as const).map(game => { const cloud = saves?.find(s => s.game === game); return <section key={game}><span className="member-eyebrow">{game === 'fantasy' ? '01 / YOUR TEAM' : '02 / YOUR INSTINCT'}</span><h2>{game === 'fantasy' ? 'FANTASY GARAGE.' : 'THE CALL SHEET.'}</h2><p>{game === 'fantasy' ? 'The championship, knockout cups and your constructor story.' : 'Six calls, one confidence boost and your own prediction championship.'}</p><Link className="member-button" href={`/play/${game}`}>Race with real players ↗</Link><Link className="member-text-link" href={`/${game}`}>Open practice ↗</Link><div className="member-cloud"><h3>Practice cloud save</h3><p>{saves === null ? 'Loading cloud progress…' : cloud ? `Last saved ${new Date(cloud.updated_at).toLocaleString()}.` : 'No cloud save yet.'}</p><small>Practice is separate from online standings. Save here before switching devices.</small><div><button disabled={busy || saves === null} onClick={() => upload(game)}>Save this device’s progress ↑</button>{cloud && <button disabled={busy} onClick={() => setRestore(game)}>Restore cloud progress ↓</button>}</div>{restore === game && cloud && <div className="member-restore" role="group" aria-label="Confirm cloud restore"><p>This replaces practice progress on this device. A backup will be kept.</p><button onClick={() => download(cloud)}>Restore this save</button><button onClick={() => setRestore(null)}>Keep device progress</button></div>}<button disabled={busy} onClick={() => { try { const key = game === 'fantasy' ? STORAGE_KEY : PREDICTION_STORAGE; const backup = localStorage.getItem(`${key}:before-cloud-restore`); if (!backup) { setNotice('No earlier device backup is available.'); return } localStorage.setItem(key, backup); setNotice('Previous device progress restored. Reopen the game to continue.') } catch { setNotice('Could not restore the device backup.') } }}>Recover previous device save</button></div></section> })}</div>
    <footer><button disabled={busy} onClick={refresh}>Reload cloud saves</button><button disabled={busy} onClick={async () => { setBusy(true); try { await request('/api/account/auth', { action: 'signout' }); window.location.assign('/login') } catch { setNotice('Sign out failed. Please retry.'); setBusy(false) } }}>Sign out of this device ↗</button></footer>
  </div>
}
