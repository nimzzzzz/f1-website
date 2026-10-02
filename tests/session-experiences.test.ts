import { describe, expect, it } from 'vitest'
import type { Driver, RaceControl, Stint, Weather } from '../lib/openf1'
import { strategyStints, strategyDrivers, stintAtLap, tyreAge, compoundMix, compoundUsage } from '../lib/stint-story'
import { weatherReadings, compassPoint, weatherBounds, weatherPath, nearestWeather } from '../lib/weather-story'
import { controlMessages, controlCategory, controlScope, featuredControl, controlDeployments, nearestControl } from '../lib/control-story'

const stint = (changes:Partial<Stint>={}):Stint => ({meeting_key:1,session_key:10,driver_number:4,stint_number:1,compound:'MEDIUM',lap_start:1,lap_end:10,tyre_age_at_start:3,...changes})
const weather = (changes:Partial<Weather>={}):Weather => ({meeting_key:1,session_key:10,date:'2026-09-26T10:00:00Z',air_temperature:0,track_temperature:20,humidity:50,pressure:1020,wind_direction:0,wind_speed:0,rainfall:false,...changes})
const control = (changes:Partial<RaceControl>={}):RaceControl => ({meeting_key:1,session_key:10,date:'2026-09-26T10:00:00Z',driver_number:null,lap_number:1,category:'Flag',flag:'YELLOW',scope:'Sector',sector:7,message:'YELLOW IN TRACK SECTOR 7',...changes})

describe('stint strategy integrity',()=>{
  it('uses inclusive ranges and keeps used-tyre starting age',()=>{
    const rows=strategyStints([stint(),stint({stint_number:2,lap_start:11,lap_end:25,compound:'HARD',tyre_age_at_start:0})],10)
    const [driver]=strategyDrivers(rows,[],10)
    expect(rows.map(r=>r.length)).toEqual([10,15])
    expect(stintAtLap(driver,10)?.stint).toBe(1)
    expect(stintAtLap(driver,11)?.stint).toBe(2)
    expect(tyreAge(rows[0],1)).toBe(3)
    expect(tyreAge(rows[0],10)).toBe(12)
    expect(tyreAge(rows[0],11)).toBeNull()
  })
  it('deduplicates stints without losing a completed range to an incomplete duplicate',()=>{
    const rows=strategyStints([stint(),stint({lap_end:null as unknown as number}),stint({session_key:11}),stint({driver_number:0})],10)
    expect(rows).toHaveLength(1); expect(rows[0].end).toBe(10)
  })
  it('does not extend open ranges or close recorded gaps',()=>{
    const rows=strategyStints([stint({lap_end:5}),stint({stint_number:2,lap_start:9,lap_end:null as unknown as number})],10)
    const [driver]=strategyDrivers(rows,[],10)
    expect(stintAtLap(driver,6)).toBeNull();expect(stintAtLap(driver,9)).toBeNull()
    expect(rows[1].length).toBeNull();expect(compoundUsage(rows)[0]).toMatchObject({count:2,timed:1,laps:5,longest:5})
  })
  it('treats overlaps as uncertain and prevents wrong-session roster identity',()=>{
    const rows=strategyStints([stint(),stint({stint_number:2,lap_start:8,lap_end:12})],10)
    const [driver]=strategyDrivers(rows,[{session_key:11,driver_number:4,last_name:'Wrong'} as Driver],10)
    expect(driver.surname).toBe('Driver 4');expect(stintAtLap(driver,9)).toBeNull()
    expect(compoundMix([driver],9)).toMatchObject({covered:0,missing:1})
  })
  it('keeps unknown compounds distinct and invalid lengths unavailable',()=>{
    const rows=strategyStints([stint({compound:'TEST',lap_start:10,lap_end:8,tyre_age_at_start:-1})],10)
    expect(rows[0]).toMatchObject({compound:'UNKNOWN',length:null,age:null})
  })
})

describe('weather observations',()=>{
  it('keeps zero wind and temperature, and distinguishes missing rainfall from no rain',()=>{
    const rows=weatherReadings([weather(),weather({date:'2026-09-26T10:01:00Z',rainfall:null as unknown as boolean})],10)
    expect(rows[0]).toMatchObject({air:0,wind:0,rain:false,direction:0});expect(rows[1].rain).toBeNull()
  })
  it('normalizes numeric rain flags, valid bearings and dates, with session isolation',()=>{
    const rows=weatherReadings([weather({date:'invalid'}),weather({session_key:11}),weather({wind_direction:360,rainfall:1 as unknown as boolean}),weather({date:'2026-09-26T10:01:00Z',wind_speed:-1,humidity:110,pressure:0,wind_direction:400})],10)
    expect(rows).toHaveLength(2);expect(rows[0]).toMatchObject({rain:true,direction:0})
    expect(rows[1]).toMatchObject({wind:null,humidity:null,pressure:null,direction:null})
    expect(compassPoint(359)).toBe('N');expect(compassPoint(91)).toBe('E');expect(compassPoint(null)).toBe('N/A')
  })
  it('merges duplicate partial readings and sorts actual timestamps',()=>{
    const rows=weatherReadings([weather({date:'2026-09-26T10:02:00Z'}),weather(),weather({date:'2026-09-26T10:00:00.000+00:00',track_temperature:null as unknown as number})],10)
    expect(rows).toHaveLength(2);expect(rows[0].track).toBe(20)
    expect(nearestWeather(rows,0)).toBe(0);expect(nearestWeather(rows,1)).toBe(1)
  })
  it('breaks chart paths at missing observations and gaps longer than three minutes',()=>{
    const rows=weatherReadings([weather(),weather({date:'2026-09-26T10:01:00Z'}),weather({date:'2026-09-26T10:02:00Z',track_temperature:null as unknown as number}),weather({date:'2026-09-26T10:03:00Z'}),weather({date:'2026-09-26T10:10:00Z'})],10)
    const bounds=weatherBounds(rows),path=weatherPath(rows,'track',bounds.min,bounds.max)
    expect(path.match(/M/g)).toHaveLength(3);expect(path.match(/L/g)).toHaveLength(1)
    expect(bounds).toEqual({min:-3,max:23})
  })
})

describe('race control source fidelity',()=>{
  it('deduplicates exact messages without collapsing distinct calls at the same second',()=>{
    const rows=controlMessages([control(),control({date:'2026-09-26T10:00:00.000+00:00'}),control({sector:8,message:'YELLOW IN TRACK SECTOR 8'}),control({session_key:11})],10)
    expect(rows).toHaveLength(2);expect(rows[0].message).toBe('YELLOW IN TRACK SECTOR 7')
  })
  it('does not mistake a later local sector clear for the latest track-wide call',()=>{
    const rows=controlMessages([control({scope:'Track',sector:null,flag:'CHEQUERED',message:'CHEQUERED FLAG'}),control({date:'2026-09-26T10:02:00Z',flag:'CLEAR',message:'CLEAR IN TRACK SECTOR 7'})],10)
    expect(featuredControl(rows)?.flag).toBe('CHEQUERED');expect(controlScope(rows[1])).toBe('SECTOR 7')
  })
  it('counts deployments, excluding ending messages, negations and ordinary text mentions',()=>{
    const rows=controlMessages([control({category:'SafetyCar',flag:null,message:'SAFETY CAR DEPLOYED'}),control({category:'SafetyCar',flag:null,message:'VIRTUAL SAFETY CAR DEPLOYED'}),control({category:'SafetyCar',flag:null,message:'SAFETY CAR IN THIS LAP'}),control({category:'SafetyCar',flag:null,message:'SAFETY CAR NOT DEPLOYED'}),control({category:'Other',flag:null,message:'CAR 4 UNDER INVESTIGATION DURING SAFETY CAR DEPLOYED PERIOD'})],10)
    expect(controlDeployments(rows)).toBe(2)
    expect(controlCategory(control({category:'Other',flag:null,message:'CAR 4 UNDER INVESTIGATION'}))).toBe('Decisions')
    expect(controlCategory(control({category:'Drs',flag:null,message:'DRS ENABLED'}))).toBe('DRS')
  })
  it('selects within the clicked timeline category using the full session time scale',()=>{
    const rows=controlMessages([control(),control({date:'2026-09-26T10:02:00Z',category:'SafetyCar',flag:null,message:'SAFETY CAR DEPLOYED'}),control({date:'2026-09-26T10:02:01Z'}),control({date:'2026-09-26T10:10:00Z',message:'LAST FLAG'})],10)
    expect(nearestControl(rows,0.201,'Safety car')?.message).toBe('SAFETY CAR DEPLOYED')
    expect(nearestControl(rows,0.201,'Flags')?.date).toBe('2026-09-26T10:02:01.000Z')
    expect(nearestControl(rows,0.201,'DRS')).toBeNull()
  })
  it('retains messages with missing time and excludes them from time selection',()=>{
    const rows=controlMessages([control(),control({date:'bad',message:'UNTIMED CALL',lap_number:0})],10)
    expect(rows).toHaveLength(2);expect(rows[1]).toMatchObject({time:null,lap_number:null})
    expect(nearestControl(rows,1)?.message).toBe('YELLOW IN TRACK SECTOR 7')
  })
})
