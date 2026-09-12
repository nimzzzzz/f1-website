# LIGHTS OUT design refresh

## Design read and audit

An F1 fan experience with a cinematic motorsport editorial language. Targeted homepage recomposition, keeping the established LIGHTS OUT wordmark, Bebas Neue display face, Geist body/mono, black surfaces and racing red. Native CSS plus the existing Next.js, GSAP, and Framer Motion stack; no added runtime dependencies.

Design variance: 8/10. Motion intensity: 6/10. Visual density: 5/10. The existing race and season data justify functional timing labels, constructor colours and championship positions. The dark brand theme and all existing route slugs, metadata and detailed tools remain intact.

Before: full-height text and faint circuit art, mandatory six-second intro, primary navigation behind a menu, tiny driver headshots, similarly composed text sections, few invitations to explore the deeper data.

After:
- Full-bleed motorsport hero with dynamic race identity and actual circuit outline.
- Immediately visible page; the existing film is an optional, lazy-loaded experience.
- Existing menu-button header and centred race ticker retained across screen sizes.
- Weekend timetable with UTC/local time control and actual next/live/completed states.
- Driver portraits, livery colours, points gaps, profile links, and dated standings.
- Compact last-race podium.
- Interactive constructor selector with all available teams, their actual car images, standings and detail links.
- Garage photography and direct entrances to lap times, positions, tyres, stops and race control.
- Existing interactive season timeline retained; new large-format footer.

Animations acknowledge state changes or reveal section hierarchy. Existing reduced-motion and keyboard-focus handling are retained. Layouts explicitly collapse below 768px. No invented racing statistics or external data services were introduced.

## Generated asset

Built-in imagegen produced `public/media/lights-out-hero.webp` (77,570 bytes). This fictional motorsport illustration is retained as an unused prototype asset. The live homepage uses circuit photography from `NowBackdrop`. The original PNG remains in the imagegen output directory.

Prompt: Create a cinematic wide landscape 16:9 editorial motorsport image for a premium Formula 1 fan website called LIGHTS OUT. No text, logos, lettering or watermarks. A fictional modern red and black open-wheel racing car from a low rear three-quarter angle, dominating the right half and lower-right, racing on dark asphalt at dusk. Fine golden underfloor sparks, red rear light, realistic slick tyres and aerodynamic bodywork, panning motion blur with a sharp car. Rich red livery and graphite background. Leave the left 45 percent predominantly dark for a headline. Controlled photographic lighting; no science fiction, neon effects, crowds or people. Full bleed.

## Verification

Production build and TypeScript validation passed. 174 tests passed across the completed design work, including six homepage cases for session sorting, cancelled sessions, exact start/end boundaries and countdown rollovers. Browser review covered the desktop hero, weekend anchor, UTC/local time switch, driver section and constructor showcase. Final local mobile Lighthouse (412 × 823, simulated throttling): performance 86/100, accessibility 100/100, FCP 0.9 s, LCP 4.2 s, CLS 0, total blocking time 10 ms. LCP remains above the 2.5 s target under this simulation. No intro video or poster was requested on initial load. The earlier build with a mandatory intro scored 70/100 performance. The optional film was checked with Escape dismissal and correct focus restoration. The full navigation menu was also checked. Data source lockouts used the existing production-snapshot fallback successfully.


## Scope correction

The broader redesign is paused for page-by-page collaboration. The original menu-button header and centred race ticker have been restored; the extra primary-navigation row is removed. The homepage once again uses the existing circuit-photo manifest and circuit-outline fallback through `NowBackdrop`. The generated generic racing image is no longer used by the site. This release publishes the current homepage together with the subsequently refined schedule, standings and driver pages; further redesigns continue page by page.
