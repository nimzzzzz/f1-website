import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { accountConfig } from './config'

export async function accountClient() {
  const config = accountConfig()
  if (!config) return null
  const jar = await cookies()
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch { /* Server-component refresh is handled by proxy. */ } },
    },
  })
}

export async function authenticatedAccount() {
  const client = await accountClient()
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  return !error && data.user ? { client, user: data.user } : null
}
