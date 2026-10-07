'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import RacingFilm from './RacingFilm'

export default function LoginClient({ connected, next }: { connected: boolean; next: string }) {
  const [email, setEmail] = useState(''), [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [cooldown, setCooldown] = useState(0)
  const codeInput = useRef<HTMLInputElement>(null)
  useEffect(() => { if (step === 'code') codeInput.current?.focus() }, [step])
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  async function submit(action: 'send' | 'verify') {
    if (busy || !connected) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/account/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email, code }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (action === 'send') { setStep('code'); setCooldown(60); setMessage('Check your inbox for your six-digit access code.') }
      else window.location.assign(next)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection interrupted. Please try again.') }
    finally { setBusy(false) }
  }
  return <div className="signin-stage">
    <RacingFilm />
    <div className="signin-brand" aria-hidden="true"><span>LIGHTS</span><span>OUT.</span></div>
    <section className="signin-panel" aria-labelledby="signin-title">
      <div className="signin-content">
        <p className="signin-eyebrow">THE PADDOCK</p>
        <h1 id="signin-title">{step === 'email' ? 'SIGN IN.' : 'CHECK YOUR EMAIL.'}</h1>
        <p className="signin-intro">{step === 'email' ? 'Your Fantasy team. Your predictions. All in one place.' : `We sent a six-digit code to ${email}.`}</p>
        <form onSubmit={event => { event.preventDefault(); void submit(step === 'email' ? 'send' : 'verify') }}>
          {step === 'email' ? <label htmlFor="paddock-email">Email address<input id="paddock-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={!connected || busy} /></label> : <label htmlFor="paddock-code">Access code<input ref={codeInput} id="paddock-code" className="signin-code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} /></label>}
          <button className="signin-submit" disabled={!connected || busy}>{busy ? 'Just a moment…' : step === 'email' ? 'Continue with email' : 'Sign in'}<span aria-hidden>↗</span></button>
          <p role="status" className="signin-feedback">{message}</p>
        </form>
        {!connected && <p className="signin-unavailable">Sign-in is opening soon. You can play both practice games below.</p>}
        {step === 'code' ? <div className="signin-code-actions"><button disabled={busy || cooldown > 0} onClick={() => submit('send')}>{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</button><button disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage('') }}>Change email</button></div> : <p className="signin-note">No password. New here? Your first code creates your account. Your email stays private.</p>}
        <div className="signin-practice"><p>Explore the games</p><div><Link href="/fantasy">Fantasy <span aria-hidden>↗</span></Link><Link href="/predictions">Predictions <span aria-hidden>↗</span></Link></div></div>
      </div>
    </section>
  </div>
}
