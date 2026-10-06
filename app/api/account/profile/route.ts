import { authenticatedAccount } from '@/lib/supabase/server'
import { json, readBody } from '@/lib/games/http'
export async function GET() {
  const account = await authenticatedAccount()
  if (!account) return json({ error: 'Sign in to open your account.' }, 401)
  const { data, error } = await account.client.from('player_profiles').select('display_name').eq('id', account.user.id).single()
  if (error) return json({ error: 'Your profile could not be loaded. Please retry.' }, 503)
  return json({ id: account.user.id, email: account.user.email, name: data.display_name })
}
export async function POST(request: Request) {
  const body = await readBody(request)
  if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 24) return json({ error: 'Use a name between 2 and 24 characters.' }, 400)
  const account = await authenticatedAccount()
  if (!account) return json({ error: 'Sign in to update your profile.' }, 401)
  const { error } = await account.client.rpc('update_player_name', { new_name: body.name.trim() })
  return error ? json({ error: 'Your name could not be saved. Please retry.' }, 503) : json({ ok: true })
}
