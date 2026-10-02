import Image from 'next/image'
import { pitTeams, pitTime, type PitMetric, type PitVisit } from '@/lib/pit-story'
import { teamLogoImage } from '@/lib/media-manifest'
import { teamToSlug } from '@/lib/team-data'

export default function PitTeams({ visits, metric }: { visits: PitVisit[]; metric: PitMetric }) {
  const teams = pitTeams(visits, metric)
  if (!teams.length) return null
  return <section className="pit-teams" aria-labelledby="pit-teams-title">
    <div className="pit-section-heading"><h2 id="pit-teams-title">{metric === 'stationary' ? 'THE CREW BEHIND THE CLOCK.' : 'THE TEAM PICTURE.'}</h2><p>{metric === 'stationary' ? 'Quick is one thing. Consistently quick is another. Teams ordered by median stationary time.' : 'Teams ordered by median time in the pit lane. Lane times include stops, traffic and other delays.'}</p></div>
    <div className="pit-team-list">
      {teams.map((team, i) => {
        const logo = teamLogoImage(teamToSlug(team.name))
        return <article className="pit-team" key={team.name}>
          <div className="pit-team-identity"><span className="pit-team-rank">{team.median === null ? 'N/A' : String(i + 1).padStart(2, '0')}</span>{logo && <span className="pit-team-logo"><Image src={logo} alt="" fill sizes="48px" /></span>}<h3>{team.name}</h3><i style={{ background: team.color }} aria-hidden /></div>
          <dl><div className="pit-team-median"><dt>MEDIAN</dt><dd className={pitTime(team.median).includes(':') ? 'is-long' : undefined}>{pitTime(team.median)}</dd></div><div><dt>BEST</dt><dd className={pitTime(team.best).includes(':') ? 'is-long' : undefined}>{pitTime(team.best)}</dd></div><div><dt>TIMED / VISITS</dt><dd>{team.timed}<small> / {team.count}</small></dd></div></dl>
        </article>
      })}
    </div>
    <p className="pit-note">{metric === 'stationary' ? 'Based only on published stationary timings. Stops can include work beyond changing tyres.' : 'This compares complete lane visits, not crew service speed. Extended visits remain included.'} Missing timings are excluded from medians. Times over a minute use minutes:seconds.</p>
  </section>
}
