import { accountClient } from '@/lib/supabase/server'
import { json, readBody } from '@/lib/games/http'

export async function POST(request: Request) {
  const body = await readBody(request)
  if (!body) return json({ error: 'Invalid request. Refresh and try again.' }, 400)
  const client = await accountClient()
  if (!client) return json({ error: 'Accounts are not connected yet. Practice is available now.' }, 503)
  try {
    if (body.action === 'signout') {
      const { error } = await client.auth.signOut({ scope: 'local' })
      return error ? json({ error: 'Could not sign out. Please retry.' }, 503) : json({ ok: true })
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
    if (body.action === 'send') {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) return json({ error: error.status === 429 ? 'Please wait a minute before requesting another code.' : 'The code could not be sent. Please try again shortly.' }, error.status === 429 ? 429 : 503)
      return json({ ok: true })
    }
    if (body.action === 'verify' && typeof body.code === 'string' && /^\d{6}$/.test(body.code)) {
      const { error } = await client.auth.verifyOtp({ email, token: body.code, type: 'email' })
      return error ? json({ error: 'That code is invalid or expired. Try again or request a new one.' }, 400) : json({ ok: true })
    }
    return json({ error: 'Check your details and try again.' }, 400)
  } catch { return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, 503) }
}
