'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import GridEntrance from './GridEntrance'
import PaddockPass from './PaddockPass'

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
    <GridEntrance />
    <section className="paddock-access">
      <PaddockPass><div className="paddock-pass-notch" aria-hidden /><div className="paddock-pass-label"><span>LIGHTS OUT / PADDOCK PASS</span><span>{step === 'email' ? '01 / 02' : '02 / 02'}</span></div><h2>{step === 'email' ? 'YOU’RE UP.' : 'CHECK YOUR INBOX.'}</h2><p>{step === 'email' ? 'Your team. Your predictions. Your name on the leaderboard.' : `Enter the code sent to ${email}.`}</p>
        {!connected && <div className="paddock-status"><span>MEMBER ACCESS COMING SOON</span><p>Sign-in is not open yet. Jump into either practice game while we connect accounts.</p></div>}
        <form onSubmit={event => { event.preventDefault(); void submit(step === 'email' ? 'send' : 'verify') }}>
          {step === 'email' ? <label htmlFor="paddock-email">Email address<input id="paddock-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={!connected || busy} /></label> : <label htmlFor="paddock-code">Your access code<input ref={codeInput} id="paddock-code" className="paddock-code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy} /></label>}
          <button className="paddock-submit" disabled={!connected || busy}>{busy ? 'Just a moment…' : step === 'email' ? 'Send my access code' : 'Enter the paddock'}<span aria-hidden>↗</span></button>
          <p role="status" className="paddock-feedback">{message}</p>
        </form>
        {step === 'code' ? <div className="paddock-code-actions"><button disabled={busy || cooldown > 0} onClick={() => submit('send')}>{cooldown ? `Resend in ${cooldown}s` : 'Send a new code'}</button><button disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage('') }}>Change email</button></div> : <p className="paddock-small">New here? Your first code creates your account. No password needed. Your email stays private.</p>}
        <div className="paddock-practice"><span>TAKE A PRACTICE LAP</span><Link href="/fantasy">Fantasy practice <span aria-hidden>↗</span></Link><Link href="/predictions">Prediction practice <span aria-hidden>↗</span></Link></div>
        <div className="paddock-pass-footer" aria-hidden><span>ALL WEEKEND ACCESS</span><i className="paddock-barcode" /></div>
      </PaddockPass>
    </section>
  </div>
}
