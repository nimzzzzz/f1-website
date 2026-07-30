// Curated constructor facts for /teams/[slug] — THE MACHINE.
//
// Facts only, no prose. Keyed by teamToSlug() of the bundle's team names.
// Semantics:
//   founded      — year the CURRENT identity was established
//   firstSeason  — first F1 season of the continuous entity (start of the
//                  lineage below, where one exists)
//   titles       — constructors' championship years won UNDER THE CURRENT
//                  NAME (lineage titles belong to the lineage, the way the
//                  official record attributes them)
//   lineage      — predecessor identities in order, [] for new entries
//
// HAND-CURATED — none of this comes from the data pipeline. Team
// principals in particular change mid-season (two 2026 changes are already
// baked in below). Re-verify this file annually, and after any principal
// news.
//
// UNVERIFIED markers (`unverified` field): values still needing human
// confirmation. Everything else was reviewed 2026-07-30.

export interface TeamFacts {
  founded: number
  firstSeason: number
  base: string
  principal: string
  engine: string
  titles: number[]
  lineage: string[]
  /** Field names needing human review before this ships as fact. */
  unverified?: string[]
}

export const TEAM_FACTS: Record<string, TeamFacts> = {
  mercedes: {
    founded: 1954,
    firstSeason: 1954,
    base: 'Brackley, United Kingdom',
    principal: 'Toto Wolff',
    engine: 'Mercedes',
    titles: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    lineage: ['Tyrrell', 'BAR', 'Honda', 'Brawn', 'Mercedes'],
  },
  ferrari: {
    founded: 1929,
    firstSeason: 1950,
    base: 'Maranello, Italy',
    principal: 'Fred Vasseur',
    engine: 'Ferrari',
    titles: [1961, 1964, 1975, 1976, 1977, 1979, 1982, 1983, 1999, 2000, 2001, 2002, 2003, 2004, 2007, 2008],
    lineage: [],
  },
  mclaren: {
    founded: 1963,
    firstSeason: 1966,
    base: 'Woking, United Kingdom',
    principal: 'Andrea Stella',
    engine: 'Mercedes',
    titles: [1974, 1984, 1985, 1988, 1989, 1990, 1991, 1998, 2024, 2025],
    lineage: [],
  },
  'red-bull-racing': {
    founded: 2005,
    firstSeason: 1997,
    base: 'Milton Keynes, United Kingdom',
    principal: 'Laurent Mekies',
    engine: 'Red Bull Ford',
    titles: [2010, 2011, 2012, 2013, 2022, 2023],
    lineage: ['Stewart', 'Jaguar', 'Red Bull Racing'],
  },
  alpine: {
    founded: 2021,
    firstSeason: 1981,
    base: 'Enstone, United Kingdom',
    principal: 'Flavio Briatore',
    engine: 'Mercedes',
    titles: [],
    lineage: ['Toleman', 'Benetton', 'Renault', 'Lotus', 'Renault', 'Alpine'],
  },
  'racing-bulls': {
    founded: 2024,
    firstSeason: 1985,
    base: 'Faenza, Italy',
    principal: 'Alan Permane',
    engine: 'Red Bull Ford',
    titles: [],
    lineage: ['Minardi', 'Toro Rosso', 'AlphaTauri', 'Racing Bulls'],
  },
  'haas-f1-team': {
    founded: 2014,
    firstSeason: 2016,
    base: 'Kannapolis, United States',
    principal: 'Ayao Komatsu',
    engine: 'Ferrari',
    titles: [],
    lineage: [],
  },
  williams: {
    founded: 1977,
    firstSeason: 1978,
    base: 'Grove, United Kingdom',
    principal: 'James Vowles',
    engine: 'Mercedes',
    titles: [1980, 1981, 1986, 1987, 1992, 1993, 1994, 1996, 1997],
    lineage: [],
  },
  audi: {
    founded: 2026,
    firstSeason: 1993,
    base: 'Hinwil, Switzerland',
    // Binotto took the TP role two races into 2026 (Wheatley's exit
    // announced 20 March 2026), alongside heading the Audi F1 Project.
    principal: 'Mattia Binotto',
    engine: 'Audi',
    titles: [],
    lineage: ['Sauber', 'BMW Sauber', 'Sauber', 'Alfa Romeo', 'Kick Sauber', 'Audi'],
  },
  'aston-martin': {
    founded: 2021,
    firstSeason: 1991,
    base: 'Silverstone, United Kingdom',
    // VOLATILE: Newey holds the TP role from 2026 (Cowell is CEO), and
    // Wheatley is rumoured to succeed him — re-check this one first.
    principal: 'Adrian Newey',
    engine: 'Honda',
    titles: [],
    lineage: ['Jordan', 'Midland', 'Spyker', 'Force India', 'Racing Point', 'Aston Martin'],
  },
  cadillac: {
    founded: 2026,
    firstSeason: 2026,
    base: 'Fishers, United States',
    principal: 'Graeme Lowdon',
    engine: 'Ferrari',
    titles: [],
    lineage: [],
    unverified: ['base (US HQ vs the Silverstone UK operations split)'],
  },
}

export const teamFacts = (slug: string): TeamFacts | null => TEAM_FACTS[slug] ?? null
