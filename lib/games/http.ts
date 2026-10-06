import { NextResponse } from 'next/server'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return Boolean(origin && origin === new URL(request.url).origin)
}
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!sameOrigin(request) || !request.headers.get('content-type')?.startsWith('application/json')) return null
  // Bound streamed bodies too; Content-Length is client-controlled.
  const reader = request.body?.getReader()
  if (!reader) return null
  let length = 0; const chunks: Uint8Array[] = []
  while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 65536) { await reader.cancel(); return null } chunks.push(value) }
  try { const bytes = new Uint8Array(length); let offset = 0; chunks.forEach(c => { bytes.set(c, offset); offset += c.length }); const value = JSON.parse(new TextDecoder().decode(bytes)); return value && !Array.isArray(value) && typeof value === 'object' ? value : null } catch { return null }
}
export function safeReturnPath(value: unknown) {
  return typeof value === 'string' && /^\/(account|play\/(fantasy|predictions))(\?[^\\]*)?$/.test(value) ? value : '/account'
}
