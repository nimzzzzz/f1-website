'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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
  return (
    <section className="account-panel" aria-labelledby="account-title">
      <div className="account-form-content">
        <p className="account-label">Your account</p>
        <h1 id="account-title">{step === 'email' ? 'Sign in to Lights Out.' : 'Check your email.'}</h1>
        <p className="account-intro">
          {step === 'email'
            ? 'Sign in to save your Fantasy team and race predictions.'
            : `Enter the six-digit code we sent to ${email}.`}
        </p>

        <form onSubmit={event => { event.preventDefault(); void submit(step === 'email' ? 'send' : 'verify') }} aria-busy={busy}>
          {step === 'email' ? (
            <div className="account-field">
              <label htmlFor="paddock-email">Email address</label>
              <input id="paddock-email" name="email" type="email" autoComplete="email" required maxLength={254}
                value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"
                disabled={!connected || busy} aria-describedby={!connected ? 'account-availability' : 'account-email-help'} />
            </div>
          ) : (
            <div className="account-field">
              <label htmlFor="paddock-code">Verification code</label>
              <input ref={codeInput} id="paddock-code" name="code" className="account-code" inputMode="numeric"
                pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={busy} />
            </div>
          )}
          <button className="account-submit" disabled={!connected || busy}>
            <span>{busy ? 'Please wait…' : step === 'email' ? 'Continue with email' : 'Verify and sign in'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p role="status" className="account-feedback">{message}</p>
        </form>

        {!connected && <p id="account-availability" className="account-availability">Account sign-in is coming soon. Both practice games are open.</p>}
        {step === 'code' ? (
          <div className="account-code-actions">
            <button disabled={busy || cooldown > 0} onClick={() => submit('send')}>{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</button>
            <button disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage('') }}>Change email</button>
          </div>
        ) : <p id="account-email-help" className="account-help">We’ll email you a sign-in code. No password needed.<br />New here? Your first code creates your account.<br />Your email stays private.</p>}
      </div>

      <div className="account-explore">
        <p>Try a practice game</p>
        <div className="account-games">
          <Link href="/fantasy"><span>Fantasy</span><span aria-hidden="true">↗</span></Link>
          <Link href="/predictions"><span>Predictions</span><span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  )
}
