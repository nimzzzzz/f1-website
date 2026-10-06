import { CALL_INFO, pickLabel, predictionOutcome, scoreTicket, type Entry } from './game'

/** Local canvas export: no personal data leaves the browser. */
export async function createPredictionCard(entry: Entry, name: string) {
  await document.fonts.ready
  const score = scoreTicket(entry.ticket, predictionOutcome(entry.round))
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image export is unavailable in this browser.')
  const display = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'sans-serif'
  const mono = 'monospace'
  ctx.fillStyle = '#111113'; ctx.fillRect(0, 0, 1200, 1500)
  ctx.fillStyle = '#9bebd2'; ctx.fillRect(0, 0, 1200, 12)
  const text = (value: string, x: number, y: number, size: number, colour = '#f5f4ef', font = mono) => { ctx.font = `${size}px ${font}`; ctx.fillStyle = colour; ctx.fillText(value, x, y) }
  text('LIGHTS OUT / PREDICTIONS', 70, 95, 23)
  text('I CALLED IT.', 64, 310, 180, '#9bebd2', display)
  text(`${name.toUpperCase()} · WEEKEND ${String(entry.round).padStart(2, '0')}`, 70, 380, 23)
  text(String(score.total), 65, 645, 260, '#f5f4ef', display)
  text('POINTS', 410, 620, 32)
  text(`${score.exact} / 6 EXACT CALLS`, 700, 560, 25, '#9bebd2')
  text(`+${score.bonus} CONFIDENCE BONUS`, 700, 610, 22)
  score.calls.forEach((call, i) => {
    const y = 742 + i * 93
    ctx.fillStyle = '#3a3a3b'; ctx.fillRect(70, y - 33, 1060, 1)
    text(CALL_INFO[call.call].label.toUpperCase(), 70, y + 5, 19, '#b0b0b5')
    text(pickLabel(call.picked).toUpperCase(), 400, y + 5, 24)
    text(`+${call.total}`, 1030, y + 5, 30, call.total ? '#9bebd2' : '#b0b0b5')
    text(call.verdict === 'exact' ? 'EXACT' : call.verdict === 'partial' ? 'PARTIAL' : 'MISSED', 400, y + 33, 14, '#b0b0b5')
  })
  text('PRACTICE EDITION · SIMULATED RESULTS', 70, 1370, 21, '#9bebd2')
  text('f1-website-three.vercel.app/predictions', 70, 1420, 20, '#b0b0b5')
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not create your image.')), 'image/png'))
  return { url: URL.createObjectURL(blob), filename: `lights-out-predictions-weekend-${entry.round}.png` }
}
