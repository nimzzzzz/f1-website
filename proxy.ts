import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { accountConfig } from '@/lib/supabase/config'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  response.headers.set('Cache-Control', 'private, no-store')
  const config = accountConfig()
  if (!config) return response
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        response.headers.set('Cache-Control', 'private, no-store')
      },
    },
  })
  try { await client.auth.getClaims() } catch { /* Protected routes independently verify identity and fail closed. */ }
  return response
}
export const config = { matcher: ['/login', '/account', '/play/:path*', '/api/account/:path*', '/api/play/:path*'] }
