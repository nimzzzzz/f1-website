import { notFound } from 'next/navigation'
import { accountConfig } from '@/lib/supabase/config'
import { authenticatedAccount } from '@/lib/supabase/server'
import CompetitionClient from './CompetitionClient'
import '../play.css'
export const metadata = { title: 'THE REAL GRID', robots: { index:false, follow:false } }
export default async function PlayPage({params}: {params:Promise<{game:string}>}) {
  const {game}=await params
  if(game!=='fantasy' && game!=='predictions') notFound()
  const account=await authenticatedAccount()
  return <CompetitionClient game={game} connected={Boolean(accountConfig())} signedIn={Boolean(account)} />
}
