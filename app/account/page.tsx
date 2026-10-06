import { redirect } from 'next/navigation'
import { authenticatedAccount } from '@/lib/supabase/server'
import { routeMeta } from '@/lib/seo'
import AccountClient from './AccountClient'
import './account.css'
export const metadata = routeMeta({ path: 'account', title: 'YOUR PADDOCK', description: 'Your profile and saved game progress.', noindex: true })
export default async function AccountPage() {
  if (!await authenticatedAccount()) redirect('/login')
  return <AccountClient />
}
