// JSON-LD, kept to what genuinely maps.
//
// INCLUDED:
//   WebSite      — the site itself, with its name and canonical URL.
//   SportsEvent  — the scheduled rounds on /schedule. Each has a real name,
//                  a start date, a location and, crucially, an eventStatus:
//                  the site models cancellation properly, so the two
//                  cancelled rounds are marked EventCancelled rather than
//                  quietly omitted or advertised as still happening.
//
// DELIBERATELY LEFT OUT, because forcing them would mean inventing
// structure the data does not have:
//   SportsOrganization / Person for teams and drivers — schema.org has no
//     way to express a constructors' championship position, and the useful
//     part of those pages (points, gaps, round-by-round results) has no
//     vocabulary. A Person carrying nothing but a name is markup for its
//     own sake.
//   ItemList for the standings — the ordering IS the meaning, and ItemList
//     carries a position without carrying what the position is in.
//   Dataset for the telemetry pages — those are noindex, so annotating them
//     would be describing a page we have asked crawlers to ignore.

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // The payload is built from our own season bundle, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
