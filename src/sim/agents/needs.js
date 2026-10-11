// Energy, morale and focus drift every tick, depending on what the agent is doing.

import { minuteOfDay } from '../clock.js'
import { WORK_END } from '../constants.js'

const WORKING = new Set(['type', 'tinker', 'present'])

export const isOvertime = (clock) => {
  const m = minuteOfDay(clock)
  return m >= WORK_END || m < 8 * 60
}

export function updateNeeds(S, a, dt) {
  if (a.hidden) return
  const working = WORKING.has(a.act)
  const overtime = isOvertime(S.clock)
  let drain = working ? 0.0015 : a.act === 'walk' ? 0.0006 : 0.00025
  if (overtime) drain *= 1.6
  a.energy = Math.max(0, a.energy - drain * dt)
  if (overtime && working) a.morale -= 0.0006 * dt
  if (a.energy < 0.2) a.morale -= 0.0004 * dt
  a.morale += (0.7 - a.morale) * 0.0004 * dt
  a.morale = Math.min(1, Math.max(0, a.morale))
  if (!working) a.focus = Math.max(0.3, a.focus - 0.004 * dt)
}
