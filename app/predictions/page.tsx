import { routeMeta } from '@/lib/seo'
import PredictionsClient from './PredictionsClient'
import './predictions.css'

export const metadata = routeMeta({ path: 'predictions', title: 'PREDICTIONS | I CALLED IT.', description: 'Call pole, pick the podium and back your strongest prediction. A separate race-weekend prediction game from LIGHTS OUT.', noindex: true })
export default function PredictionsPage() { return <PredictionsClient /> }
