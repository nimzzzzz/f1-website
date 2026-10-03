import { routeMeta } from '@/lib/seo'
import FantasyClient from './FantasyClient'
import './fantasy.css'

export const metadata = routeMeta({
  path: 'fantasy', title: 'FANTASY | YOUR TEAM. YOUR CALL.',
  description: 'Build your own racing team. Assign driver roles, fight for the season championship and take on a knockout cup.',
  noindex: true,
})

export default function FantasyPage() { return <FantasyClient /> }
