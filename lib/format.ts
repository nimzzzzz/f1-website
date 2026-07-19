// openf1 numeric fields are not reliably numbers: after post-session data
// reprocessing they can arrive as strings ("5082.855"), and during live
// sessions as null. Every formatter that calls a number method must coerce
// through this first — a string slipping into .toFixed() took down
// /results on race day.
export const asNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
