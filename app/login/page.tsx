import { redirect } from 'next/navigation'
import { accountConfig } from '@/lib/supabase/config'
import { authenticatedAccount } from '@/lib/supabase/server'
import { safeReturnPath } from '@/lib/games/http'
import { routeMeta } from '@/lib/seo'
import LoginClient from './LoginClient'
import './login.css'
export const metadata = routeMeta({ path: 'login', title: 'YOUR PADDOCK PASS', description: 'Your team. Your calls. Your place on the grid.', noindex: true })
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next)
  if (await authenticatedAccount()) redirect(next)
  return <LoginClient connected={Boolean(accountConfig())} next={next} />
}
