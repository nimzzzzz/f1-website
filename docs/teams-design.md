# Constructor detail redesign

Scope: `/teams/[slug]` only. The all-teams scrolling gallery, its geometry,
render calibration and route are unchanged. Existing URLs, metadata, ISR,
snapshot refresh and the site menu remain in place.

Design read: an F1 constructor showcase with the presentation of a team
launch and the useful detail of a pit wall. LIGHTS OUT's existing dark
surfaces, Bebas/Geist typography, real team liveries and photography carry
it. Design variance 8, motion 7, density 5. No new dependencies or assets.

The former page separated a mostly empty garage hero from the actual car,
then repeated text sections and points totals. The replacement combines
identity and car in the opening viewport, uses paired photographic driver
bays, a selectable race results wall, a constructor archive and a next-team
entrance. The car controls crop the actual high-resolution side render;
there is no simulated 3D model or fabricated telemetry.

- `TeamMachine.tsx`: live snapshot adoption and constructor composition.
- `TeamCar.tsx`: full car, cockpit, rear and front-wing framing; larger image
  renditions are requested only when the viewer inspects a detail.
- `TeamPitWall.tsx`: all calendar rounds, horizontally scrollable selectors,
  individual GP results, separate sprint points, combined driver points,
  original season metrics and a best-weekend shortcut.
- `useTeamMotion.ts`: scoped GSAP arrivals with cleanup and live
  reduced-motion changes. Car arrival and view changes use CSS transforms.
- `team-machine.css`: route-scoped styles, single-column mobile layouts,
  explicit focus treatment and reduced-motion fallbacks.
- `lib/team-story.ts`: latest-round selection and driver-score arithmetic.

Data semantics: race/sprint results follow the named drivers, including
reserve drivers in the standings. They are labelled as driver totals,
since the compact bundle does not record each driver's historical team
assignment per round. Constructor championship points remain the official
team standing. Cancelled rounds retain their calendar numbers but do not
contribute scores, podiums or a best weekend. DNS, DNF, DSQ, NC and missing
entries stay distinct. A tied finish never awards a head-to-head win.

Constructor history uses the existing curated `lib/team-facts.ts`; no new
historical or technical claims were added. Existing unverified facts remain
subject to that file's maintenance notes.

Verification: production build, TypeScript and 181 tests pass, including
seven constructor tests for sprint accounting, fractional points,
cancellations, missing entries, P22, ties, reserve-driver results,
pre-season states and next-team routing. Local browser and Lighthouse
review cover full pages, the car controls, race selection and narrow
screens. Motion keeps informational text at full contrast throughout.

Final local Lighthouse: 97 performance / 100 accessibility on desktop
(Red Bull, 1200 × 780, reduced motion), and 78 / 100 on a narrow mobile
viewport (Haas, 320 × 780, simulated throttling). Both had zero layout
shift and no failing accessibility audits, including the unweighted
accessible-name checks. Simulated mobile LCP was 6.0 s, above the target;
desktop LCP was 1.3 s. The hero is eagerly loaded at high priority.
Native browser checks passed for all four car views, keyboard race
selection, cancelled/upcoming states, best-weekend selection and focus,
and next-garage navigation. The Haas monochrome logo received a final
white treatment so it remains visible on the launch-stage background.
