// Shared driver data used by both the drivers list and individual driver pages

export const DRIVER_PHOTOS: Record<string, string> = {
  RUS: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  ANT: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  LEC: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  HAM: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  NOR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  PIA: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  OCO: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  BEA: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  VER: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  HAD: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  LAW: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  LIN: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  GAS: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  COL: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  HUL: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  BOR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  SAI: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  ALB: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  PER: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  BOT: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
  ALO: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  STR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
}

export const CAREER_STATS: Record<string, {
  grandsPrix: number
  points: number
  podiums: number
  poles: number
  wins: number
  championships: number
}> = {
  VER: { grandsPrix: 235, points: 3452.5, podiums: 127, poles: 48, wins: 71,  championships: 4 },
  HAM: { grandsPrix: 382, points: 5051.5, podiums: 203, poles: 104, wins: 105, championships: 7 },
  LEC: { grandsPrix: 173, points: 1706,   podiums: 51,  poles: 27, wins: 8,   championships: 0 },
  NOR: { grandsPrix: 154, points: 1445,   podiums: 44,  poles: 16, wins: 11,  championships: 1 },
  RUS: { grandsPrix: 154, points: 1084,   podiums: 26,  poles: 8,  wins: 6,   championships: 0 },
  ANT: { grandsPrix: 26,  points: 197,    podiums: 5,   poles: 1,  wins: 1,   championships: 0 },
  PIA: { grandsPrix: 72,  points: 802,    podiums: 26,  poles: 6,  wins: 9,   championships: 0 },
  ALO: { grandsPrix: 429, points: 2393,   podiums: 106, poles: 22, wins: 32,  championships: 2 },
  STR: { grandsPrix: 192, points: 325,    podiums: 3,   poles: 1,  wins: 0,   championships: 0 },
  SAI: { grandsPrix: 232, points: 1338.5, podiums: 29,  poles: 6,  wins: 4,   championships: 0 },
  ALB: { grandsPrix: 130, points: 313,    podiums: 2,   poles: 0,  wins: 0,   championships: 0 },
  GAS: { grandsPrix: 179, points: 467,    podiums: 5,   poles: 0,  wins: 1,   championships: 0 },
  COL: { grandsPrix: 29,  points: 6,      podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  HUL: { grandsPrix: 253, points: 622,    podiums: 1,   poles: 1,  wins: 0,   championships: 0 },
  BOR: { grandsPrix: 26,  points: 21,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  BEA: { grandsPrix: 29,  points: 65,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  OCO: { grandsPrix: 182, points: 483,    podiums: 4,   poles: 0,  wins: 1,   championships: 0 },
  LAW: { grandsPrix: 37,  points: 52,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  HAD: { grandsPrix: 25,  points: 55,     podiums: 1,   poles: 0,  wins: 0,   championships: 0 },
  LIN: { grandsPrix: 2,   points: 4,      podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
}

// Map a hex team colour to the nearest GlowCard glowColor
export function teamColorToGlow(hex: string): 'blue' | 'purple' | 'green' | 'red' | 'orange' {
  const map: Record<string, 'blue' | 'purple' | 'green' | 'red' | 'orange'> = {
    'F47600': 'orange', // McLaren
    'E8002D': 'red',    // Ferrari
    '3671C6': 'blue',   // Red Bull
    '27F4D2': 'blue',   // Mercedes
    '00704A': 'green',  // Aston Martin
    '00A1E8': 'blue',   // Alpine
    '0082FA': 'blue',   // Williams
    '6692FF': 'purple', // Racing Bulls
    'DEE1E2': 'blue',   // Haas
    'DA291C': 'red',    // Audi
    'FFB81C': 'orange', // Cadillac
  }
  return map[hex?.toUpperCase()] ?? 'red'
}

export const DRIVER_NATIONALITIES: Record<string, string> = {
  VER: 'Dutch',
  HAM: 'British',
  LEC: 'Monégasque',
  NOR: 'British',
  RUS: 'British',
  ANT: 'Italian',
  PIA: 'Australian',
  ALO: 'Spanish',
  STR: 'Canadian',
  SAI: 'Spanish',
  ALB: 'Thai',
  GAS: 'French',
  COL: 'French',
  HUL: 'German',
  BOR: 'German',
  BEA: 'British',
  OCO: 'French',
  LAW: 'New Zealander',
  HAD: 'American',
  LIN: 'Indian',
  PER: 'Mexican',
  BOT: 'Finnish',
}
