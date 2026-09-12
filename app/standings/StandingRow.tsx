import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type StandingRowProps = {
  kind: 'driver' | 'team'
  position: number
  name: string
  fullName: string
  detail: string
  identifier: string
  colour: string
  points: number
  leaderPoints: number
  gap: number | null
  wins: number
  image: string | null
  href: string | null
}

export default function StandingRow(props: StandingRowProps) {
  const { kind, position, name, fullName, detail, identifier, colour, points, leaderPoints, gap, wins, image, href } = props
  const ratio = leaderPoints > 0 ? Math.max(0, Math.min(1, points / leaderPoints)) : 0
  const leader = position === 1
  const style = { '--team-colour': `#${colour.replace(/^#/, '')}`, '--points-width': `${ratio * 100}%` } as CSSProperties

  return (
    <div role="row" className={`standing-row standing-row--${kind}${leader ? ' standing-row--leader' : ''}${href ? ' standing-row--linked' : ''}`} style={style}>
      <div role="cell" className="standing-position" aria-label={`Position ${position}`}>{position}</div>
      <div role="cell" className="standing-identity">
        <span className="standing-wash" aria-hidden="true" />
        <span className="standing-scan" aria-hidden="true" />
        {image && <span className="standing-art" aria-hidden="true">
          {identifier && <span className="standing-acronym">{identifier}</span>}
          <span className="standing-image-window">
            <Image src={image} alt="" fill sizes={kind === 'driver' ? '(max-width: 767px) 150px, 320px' : '(max-width: 767px) 180px, 440px'}
              className="standing-image" preload={leader && kind === 'driver'} />
          </span>
        </span>}
        <div className="standing-name-block">
          {leader && <p className="standing-leader-label">Championship leader</p>}
          <p className="standing-name">{href ? <Link href={href} prefetch={false} className="standing-profile" aria-label={`View ${fullName} ${kind === 'driver' ? 'driver' : 'team'} profile`}><span className="standing-name-text">{name}</span></Link> : <span className="standing-name-text">{name}</span>}</p>
          <p className="standing-detail">
            <span className="standing-team-swatch" aria-hidden="true" /><span>{detail}</span>
            {wins > 0 && <span className="standing-wins">{wins} win{wins === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <span className="standing-points-rail" aria-hidden="true">
          <span className="standing-points-length"><span className="standing-points-fill">{ratio > 0 && <span className="standing-points-tip" />}</span></span>
        </span>
      </div>
      <div role="cell" className="standing-score">
        <p className="standing-points">{points}<span>PTS</span></p>
        <p className={`standing-gap${leader ? ' standing-gap--leader' : ''}`}>
          {gap === null ? 'LEADER' : <>
            <span className="sr-only">{gap === 0 ? 'Equal points with' : `${gap} point${gap === 1 ? '' : 's'} behind`} position {position - 1}.</span>
            <span aria-hidden="true">{gap === 0 ? `LEVEL WITH P${position - 1}` : `−${gap} TO P${position - 1}`}</span>
          </>}
        </p>
        {href && <span className="standing-profile-cue" aria-hidden="true">{kind === 'driver' ? 'Driver profile' : 'Team profile'} ↗</span>}
      </div>
    </div>
  )
}
