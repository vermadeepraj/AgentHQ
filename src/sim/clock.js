// Game time helpers. `clock` = game minutes since Day 1 00:00.

export const DAY = 1440

export const at = (day, hour, minute = 0) => (day - 1) * DAY + hour * 60 + minute
export const dayOf = (clock) => Math.floor(clock / DAY) + 1
export const minuteOfDay = (clock) => ((clock % DAY) + DAY) % DAY
export const startOfDay = (clock) => Math.floor(clock / DAY) * DAY

/** Next absolute time (>= clock) at which the minute-of-day equals `mod`. */
export function nextAt(clock, mod) {
  const t = startOfDay(clock) + mod
  return t >= clock ? t : t + DAY
}

export function fmtTime(clock) {
  const m = minuteOfDay(clock)
  const h = Math.floor(m / 60)
  const mm = Math.floor(m % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export const fmtClock = (clock) => `Day ${dayOf(clock)} · ${fmtTime(clock)}`

export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}
