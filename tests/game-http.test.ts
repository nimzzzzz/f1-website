import { describe,expect,it } from 'vitest'
import { readBody,safeReturnPath } from '@/lib/games/http'
describe('account request boundaries',()=>{
 const request=(body:string,origin='https://lightsout.test')=>new Request('https://lightsout.test/api/account/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body})
 it('rejects cross-origin writes, invalid bodies and oversized streamed payloads',async()=>{
  expect(await readBody(request('{"action":"send"}','https://attacker.test'))).toBeNull()
  expect(await readBody(request('[]'))).toBeNull()
  expect(await readBody(request('not-json'))).toBeNull()
  expect(await readBody(request(JSON.stringify({value:'a'.repeat(65536)})))).toBeNull()
  expect(await readBody(request('{"action":"send"}'))).toEqual({action:'send'})
 })
 it('limits post-login navigation to internal account/game pages',()=>{
  expect(safeReturnPath('//evil.test')).toBe('/account')
  expect(safeReturnPath('/play/fantasy\\evil')).toBe('/account')
  expect(safeReturnPath('https://evil.test')).toBe('/account')
  expect(safeReturnPath('/play/predictions')).toBe('/play/predictions')
 })
})
