import { redirect } from 'next/navigation'
import Image from 'next/image'
import singapore from '@/public/media/circuit-photos/singapore.jpg'
import { accountConfig } from '@/lib/supabase/config'
import { authenticatedAccount } from '@/lib/supabase/server'
import { safeReturnPath } from '@/lib/games/http'
import { routeMeta } from '@/lib/seo'
import LoginClient from './LoginClient'
import './login.css'
export const metadata = routeMeta({ path: 'login', title: 'SIGN IN', description: 'Sign in to save your Lights Out Fantasy team and race predictions.', noindex: true })
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next)
  if (await authenticatedAccount()) redirect(next)
  return (
    <div className="account-entry">
      <LoginClient connected={Boolean(accountConfig())} next={next} />
      <figure className="account-photo">
        <div className="account-photo-frame">
          <Image src={singapore} alt="Sparks trailing a Formula 1 car during the Singapore night race"
            fill sizes="(max-width: 767px) 130vw, (max-height: 800px) 1100px, 1600px" quality={75} loading="eager" />
        </div>
        <figcaption><span>Singapore Grand Prix</span><span>Marina Bay Street Circuit</span></figcaption>
      </figure>
    </div>
  )
}
