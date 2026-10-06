'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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
  return <div className="paddock-login">
    <section className="paddock-entrance" aria-label="Your place on the grid">
      <Image src="/media/garage.jpg" alt="Formula 1 garage prepared for a race weekend" fill sizes="(max-width: 800px) 100vw, 56vw" priority quality={90} className="paddock-photo" />
      <div className="paddock-shutter" aria-hidden /><div className="paddock-track-number" aria-hidden>01</div>
      <div className="paddock-entrance-top"><span>LIGHTS OUT / MEMBERS</span><span>PADDOCK ACCESS</span></div>
      <div className="paddock-entrance-copy"><div className="paddock-lights" aria-hidden>{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: `${i * .15}s` }} />)}</div><p>THE WEEKEND IS YOURS.</p><h1>YOUR PLACE<br />ON THE <span>GRID.</span></h1><div className="paddock-entrance-caption"><span>BUILD THE TEAM.<br />MAKE THE CALL.</span><span>LEAVE YOUR MARK.<br />EVERY WEEKEND.</span></div></div>
    </section>
    <section className="paddock-access">
      <div className="paddock-pass"><div className="paddock-pass-label"><span>MEMBER ENTRY</span><span>{step === 'email' ? '01 / 02' : '02 / 02'}</span></div><h2>{step === 'email' ? 'YOUR PADDOCK PASS.' : 'YOU’RE ONE STEP AWAY.'}</h2><p>{step === 'email' ? 'One account for your Fantasy garage, prediction record and private leagues.' : `Enter the code sent to ${email}.`}</p>
        {!connected && <div className="paddock-status"><span>THE PADDOCK OPENS SOON</span><p>Accounts are being connected. Both practice games are ready to play below.</p></div>}
        <form onSubmit={event => { event.preventDefault(); void submit(step === 'email' ? 'send' : 'verify') }}>
          {step === 'email' ? <label htmlFor="paddock-email">Email address<input id="paddock-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={!connected || busy} /></label> : <label htmlFor="paddock-code">Your access code<input ref={codeInput} id="paddock-code" className="paddock-code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} /></label>}
          <button className="paddock-submit" disabled={!connected || busy}>{busy ? 'Just a moment…' : step === 'email' ? 'Send my access code' : 'Enter the paddock'}<span aria-hidden>↗</span></button>
          <p role="status" className="paddock-feedback">{message}</p>
        </form>
        {step === 'code' ? <div className="paddock-code-actions"><button disabled={busy || cooldown > 0} onClick={() => submit('send')}>{cooldown ? `Resend in ${cooldown}s` : 'Send a new code'}</button><button disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage('') }}>Change email</button></div> : <p className="paddock-small">Sign in or create your account with a one-time email code. No password to remember. Your email stays private; your display name appears on leaderboards.</p>}
        <div className="paddock-practice"><span>GET A FEEL FOR THE GRID</span><Link href="/fantasy">Fantasy practice <span aria-hidden>↗</span></Link><Link href="/predictions">Prediction practice <span aria-hidden>↗</span></Link></div>
      </div><div className="paddock-access-footer"><span>FANTASY + PREDICTIONS</span><span>TWO GAMES. YOUR NAME.</span></div>
    </section>
  </div>
}
