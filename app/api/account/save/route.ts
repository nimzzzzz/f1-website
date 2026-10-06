import { authenticatedAccount } from '@/lib/supabase/server'
import { json, readBody } from '@/lib/games/http'
import { parseSave } from '@/lib/fantasy/practice'
import { parsePredictions } from '@/lib/predictions/game'
export async function GET() {
  const account = await authenticatedAccount()
  if (!account) return json({ error: 'Sign in to use cloud saves.' }, 401)
  const { data, error } = await account.client.from('practice_saves').select('game,data,revision,updated_at').eq('player_id', account.user.id)
  return error ? json({ error: 'Cloud saves could not be loaded.' }, 503) : json({ saves: data })
}
export async function POST(request: Request) {
  const body = await readBody(request)
  if (!body || !['fantasy', 'predictions'].includes(String(body.game)) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) return json({ error: 'Invalid save.' }, 400)
  const parse = body.game === 'fantasy' ? parseSave : parsePredictions
  const data = parse(JSON.stringify(body.data))
  if (!data) return json({ error: 'This practice save could not be read.' }, 400)
  const account = await authenticatedAccount()
  if (!account) return json({ error: 'Sign in to save your progress.' }, 401)
  const result = await account.client.rpc('save_practice', { p_game: body.game, p_data: data, p_revision: body.revision })
  if (result.error) return result.error.message.includes('SAVE_CONFLICT') ? json({ error: 'Another device updated this save. Reload cloud saves before choosing which version to keep.' }, 409) : json({ error: 'Your progress could not be saved. Please retry.' }, 503)
  return json({ revision: result.data })
}
