import type { Meeting } from '@/lib/openf1'

// Aerial circuit photos keyed by circuit short name, location, or country.
export const CIRCUIT_PHOTOS: Record<string, string> = {
  Sakhir: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Bahrain_International_Circuit%2C_November_2%2C_2017_SkySat_%28cropped%29.jpg',
  Jeddah: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff/lossy-page1-1280px-Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff.jpg',
  Melbourne: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Albert Park': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  Suzuka: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Suzuka_International_Racing_Course%2C_July_10%2C_2018_SkySat_%28cropped%29.jpg',
  Shanghai: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Shanghai_International_Circuit%2C_April_7%2C_2018_SkySat_%28rotated%29.jpg',
  Miami: '/miami-circuit.avif',
  Imola: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Autodromo_aerea_poster.jpg',
  Monaco: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Circuit_de_Monaco%2C_April_1%2C_2018_SkySat_%28cropped%29.jpg',
  Montreal: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Circuit_Gilles-Villeneuve%2C_May_29%2C_2018_SkySat_%28cropped%29.jpg',
  Barcelona: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Catalunya: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Madring: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Madrid: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Spielberg: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Luftaufnahme_%28c%29Red_Bull_Ring.jpg',
  Silverstone: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Silverstone_Circuit%2C_July_2%2C_2018_SkySat_%28cropped%29.jpg',
  Budapest: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  Hungaroring: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  Spa: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Spa-Francorchamps': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  Zandvoort: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Circuit_Park_Zandvoort_from_air_2016-08-24.jpg',
  Monza: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Autodromo_Nazionale_Monza%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  Baku: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Baku_City_Circuit%2C_April_9%2C_2018_SkySat.jpg',
  Singapore: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  'Marina Bay': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  Austin: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Circuit_of_the_Americas%2C_April_22%2C_2018_SkySat_%28cropped2%29.jpg',
  'Mexico City': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez%2C_June_4%2C_2018_SkySat_%28cropped%29.jpg',
  Interlagos: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  'São Paulo': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  'Las Vegas': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Aerial_view_of_Las_Vegas_Strip_%28Jan_5%2C_2024%29.jpg',
  Lusail: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  Qatar: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  'Yas Marina': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Yas Marina Circuit': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Abu Dhabi': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
}

// Fallback hero image when a meeting has no mapped circuit photo.
export const FALLBACK_CIRCUIT_PHOTO = '/miami-circuit.avif'

export function getCircuitPhoto(meeting: Meeting): string | null {
  return (
    CIRCUIT_PHOTOS[meeting.circuit_short_name] ??
    CIRCUIT_PHOTOS[meeting.location] ??
    CIRCUIT_PHOTOS[meeting.country_name] ??
    null
  )
}

// High-impact, full-bleed hero photos for the homepage banner — a "mix" of
// dramatic race action and iconic city/circuit scenery, distinct from the small
// aerial thumbnails used in the calendar grid (CIRCUIT_PHOTOS). Keyed by
// circuit_short_name. Any circuit not listed here falls back to its calendar
// photo, then to FALLBACK_CIRCUIT_PHOTO — see getHeroImage.
export const HERO_IMAGES: Record<string, string> = {
  Sakhir: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Manama_Night_%2859168542%29.jpeg',
  Melbourne: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Melbourne_Skyline_from_Rialto_Crop_-_Nov_2008.jpg/3840px-Melbourne_Skyline_from_Rialto_Crop_-_Nov_2008.jpg',
  Shanghai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Pudong_Shanghai_November_2017_HDR_panorama.jpg/3840px-Pudong_Shanghai_November_2017_HDR_panorama.jpg',
  Montreal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Montreal_Twilight_Panorama_2006.jpg/3840px-Montreal_Twilight_Panorama_2006.jpg',
  Catalunya: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Sagrada_Familia_in_Barcelona_10.jpg',
  Spielberg: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/FIA_F1_Austria_2022_Nr._55_Sainz_%282%29_%28edited%29.jpg/3840px-FIA_F1_Austria_2022_Nr._55_Sainz_%282%29_%28edited%29.jpg',
  Silverstone: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Lewis_Hamilton_2013_Britain_Race.jpg/3840px-Lewis_Hamilton_2013_Britain_Race.jpg',
  'Spa-Francorchamps': 'https://upload.wikimedia.org/wikipedia/commons/9/94/Ayrton_Senna_during_the_race_in_Spa-Francorchamps_on_25_August_1991.jpg',
  Hungaroring: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Fernando_Alonso_on_three_wheels_during_2009_Hungarian_Grand_Prix.jpg/3840px-Fernando_Alonso_on_three_wheels_during_2009_Hungarian_Grand_Prix.jpg',
  Madring: 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Plaza_De_Col%C3%B3n_Madrid_%28223940971%29.jpeg',
  Singapore: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Singapore_Marina_Bay_Dusk_2018-02-27.jpg/3840px-Singapore_Marina_Bay_Dusk_2018-02-27.jpg',
  Austin: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Austin_Texas_Downtown_Skyline_at_Night_%2810555159946%29.jpg/3840px-Austin_Texas_Downtown_Skyline_at_Night_%2810555159946%29.jpg',
  'Mexico City': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Mexico_City_Reforma_skyline_%28cropped%29.jpg',
  Interlagos: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/PaulistaPanorama.jpg/3840px-PaulistaPanorama.jpg',
  'Las Vegas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Night_aerial_view%2C_Las_Vegas%2C_Nevada%2C_04649u.jpg/3840px-Night_aerial_view%2C_Las_Vegas%2C_Nevada%2C_04649u.jpg',
  Lusail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Doha_Dhow_Harbour_Skyline_View_at_Night_02.jpg/3840px-Doha_Dhow_Harbour_Skyline_View_at_Night_02.jpg',
  'Yas Marina Circuit': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Yas_Marina_circuit_by_night.jpg',
}

// Resolve the homepage hero image for a meeting: a curated hero photo if we have
// one, otherwise the calendar circuit photo, otherwise the bundled fallback.
export function getHeroImage(meeting: Meeting): string {
  return (
    HERO_IMAGES[meeting.circuit_short_name] ??
    HERO_IMAGES[meeting.location] ??
    HERO_IMAGES[meeting.country_name] ??
    getCircuitPhoto(meeting) ??
    FALLBACK_CIRCUIT_PHOTO
  )
}
