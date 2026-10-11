// Creating agents and their daily cycle: arriving, going home, being paged.

import { EXIT, spots } from '../world/layout.js'
import { WORK_START, WORK_END } from '../constants.js'
import { nextAt, minuteOfDay } from '../clock.js'
import { rand, randInt } from '../rng.js'
import { emit, log, say } from '../events.js'
import { RATES } from './roster.js'

export function makeAgent(S, def, deskId, { present = true, contractor = false } = {}) {
  const seat = spots[`desk:${deskId}`]
  const md = minuteOfDay(S.clock)
  const atWork = present && md >= 7 * 60 && md < WORK_END
  return {
    id: def.id, name: def.name, first: def.name.split(' ')[0], role: def.role, team: def.team,
    primary: def.primary, skills: { ...def.skills }, reviews: def.reviews || [], lead: !!def.lead,
    speed: def.speed ?? 1, quality: def.quality ?? 1, trait: def.trait || '', look: def.look,
    desk: deskId, contractor, rate: contractor ? RATES.contractor : RATES[def.team],
    x: atWork ? seat.x : EXIT.x, z: atWork ? seat.z : EXIT.z, yaw: atWork ? seat.yaw : Math.PI,
    present: atWork, hidden: false, act: 'sit', carry: null, say: null, sayId: 0,
    energy: 0.88 + rand(S) * 0.1, morale: 0.72 + rand(S) * 0.12, focus: 0.5,
    plan: [], path: null, pathI: 0, res: [], ticket: null, why: [], thought: 'Settling in',
    memory: [], inbox: [],
    arriveAt: atWork ? -1 : nextAt(S.clock, WORK_START) + randInt(S, -15, 15),
    leftAt: S.clock - 600, energyAtLeave: 0.9,
    leaveMin: WORK_END + randInt(S, 0, 40), lunchDay: 0, coffeeDay: 0, pizzaId: 0, paged: false, burnout: false,
    stats: { done: 0, reworks: 0, reviews: 0, tests: 0, coffees: 0, minutes: 0 },
  }
}

export function arrive(S, a) {
  const hours = Math.max(0, (S.clock - a.leftAt) / 60)
  a.energy = Math.min(1, a.energyAtLeave + hours * 0.075)
  a.morale += (0.72 - a.morale) * Math.min(1, hours * 0.04)
  a.present = true
  a.hidden = false
  a.x = EXIT.x
  a.z = EXIT.z
  a.yaw = Math.PI
  a.plan = []
  a.path = null
  a.focus = 0.5
  a.burnout = false
  a.arriveAt = -1
  a.leaveMin = WORK_END + randInt(S, 0, 40)
  emit(S, 'arrive', { agent: a.id })
  if (a.paged) log(S, `${a.first} arrived (paged)`, 'info', a.id)
}

export function goHome(S, a) {
  for (const poi of a.res) if (S.reserved[poi] === a.id) delete S.reserved[poi]
  a.res = []
  a.plan = []
  a.path = null
  a.present = false
  a.hidden = false
  a.act = 'stand'
  a.carry = null
  a.ticket = null
  a.leftAt = S.clock
  a.energyAtLeave = a.energy
  const nine = nextAt(S.clock, WORK_START)
  let when = Math.max(nine, S.clock + 360) + randInt(S, -15, 20)
  if (a.burnout) when = Math.max(when, nine + 90)
  a.arriveAt = when
  a.paged = false
  emit(S, 'leave', { agent: a.id })
  if (a.burnout) log(S, `${a.first} burned out and went home`, 'bad', a.id)
}

/** Call someone in. They arrive 20–40 game minutes later (night pages hurt morale). */
export function page(S, a, delay) {
  if (a.present) return false
  a.paged = true
  a.arriveAt = S.clock + (delay ?? randInt(S, 20, 40))
  const m = minuteOfDay(S.clock)
  if (m < 7 * 60 || m >= 22 * 60) a.morale = Math.max(0, a.morale - 0.05)
  say(S, a, '📟')
  emit(S, 'page', { agent: a.id })
  log(S, `Paged ${a.first} — arriving in ~${Math.round(a.arriveAt - S.clock)} min`, 'info', a.id)
  return true
}
