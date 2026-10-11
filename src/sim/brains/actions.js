// Plan builders — *how* to do something. Brains decide *what*; commands reuse these too.

import { spots, EXIT } from '../world/layout.js'
import { dayOf } from '../clock.js'
import { rand } from '../rng.js'
import { emit } from '../events.js'
import { isFree, besideDesk } from '../agents/plans.js'

const seatOf = (a) => spots[`desk:${a.desk}`]
const to = (s, extra) => ({ k: 'goto', x: s.x, z: s.z, yaw: s.yaw, ...extra })

function freeSpot(S, a, prefix, count) {
  for (let i = 0; i < count; i++) if (isFree(S, `${prefix}:${i}`, a)) return `${prefix}:${i}`
  return null
}

export function workPlan(S, a, t) {
  if (t.launch) {
    const id = isFree(S, 'rack:0', a) ? 'rack:0' : 'rack:1'
    return [to(spots[id], { poi: id }), { k: 'work', t: t.id, left: 30, act: 'tinker' }]
  }
  return [to(seatOf(a)), { k: 'work', t: t.id, left: 35 + rand(S) * 20, act: 'type' }]
}

export function reviewPlan(S, a, t, stage) {
  const left = Math.max(10, t.effort * (stage === 'qa' ? 0.2 : 0.12))
  return [to(seatOf(a)), { k: 'review', t: t.id, stage, left }]
}

export function coffeePlan(S, a) {
  if (S.coffeeBrokenUntil <= S.clock && isFree(S, 'coffee', a)) {
    return [to(spots.coffee, { poi: 'coffee' }), { k: 'do', act: 'drink', left: 6, fx: 'coffee', carry: 'cup', yaw: spots.coffee.yaw }]
  }
  if (isFree(S, 'water', a)) {
    return [to(spots.water, { poi: 'water' }), { k: 'do', act: 'drink', left: 4, fx: 'water', carry: 'cup', yaw: spots.water.yaw }]
  }
  return null
}

export function lunchPlan(S, a) {
  a.lunchDay = dayOf(S.clock)
  const stool = rand(S) < 0.7 ? freeSpot(S, a, 'stool', 6) : null
  if (stool) return [to(spots[stool], { poi: stool }), { k: 'do', act: 'eat', left: 20, fx: 'lunch', carry: 'food', yaw: spots[stool].yaw }]
  return [to(EXIT), { k: 'away', left: 15, fx: 'lunch' }, to(seatOf(a))]
}

export function pizzaPlan(S, a) {
  const stool = freeSpot(S, a, 'stool', 6)
  if (!stool) return null
  a.pizzaId = S.pizzaId
  return [to(spots[stool], { poi: stool }), { k: 'do', act: 'eat', left: 12, fx: 'pizza', carry: 'pizza', yaw: spots[stool].yaw }]
}

export function breakPlan(S, a) {
  const waiter = S.agents.find((o) => o !== a && o.present && o.plan[0]?.waitPP)
  if (waiter && isFree(S, 'pp:1', a)) {
    const s = spots['pp:1']
    return [to(s, { poi: 'pp:1' }), { k: 'do', act: 'pingpong', left: 12, fx: 'pingpong', partner: waiter.id, yaw: s.yaw }]
  }
  if (isFree(S, 'pp:0', a) && isFree(S, 'pp:1', a) && rand(S) < 0.35) {
    const s = spots['pp:0']
    return [to(s, { poi: 'pp:0' }), { k: 'do', act: 'stand', left: 8, waitPP: true, fx: 'lounge', yaw: s.yaw }]
  }
  const seat = freeSpot(S, a, 'lounge', 5)
  if (!seat) return null
  return [to(spots[seat], { poi: seat }), { k: 'do', act: 'lounge', left: 15, fx: 'lounge', yaw: spots[seat].yaw }]
}

export function idlePlan(S, a) {
  return [to(seatOf(a)), { k: 'do', act: 'type', left: 10 + rand(S) * 10 }]
}

export function leavePlan(S, a, burnout = false) {
  a.burnout = burnout
  return [to(EXIT), { k: 'leave' }]
}

export function handoffPlan(S, a, item) {
  const target = S.agents.find((o) => o.id === item.to)
  if (!target || !target.present || target.hidden) {
    emit(S, 'ping', { from: a.id, to: item.to, kind: 'handoff' })
    return null
  }
  const p = besideDesk(target)
  return [
    { k: 'goto', x: p.x, z: p.z, yaw: p.yaw, carry: 'doc' },
    { k: 'do', act: 'talk', left: 4, yaw: p.yaw, carry: 'doc', fx: 'handoff', to: target.id, ticket: item.ticket },
  ]
}

/** Chaos: a laptop dies and its owner spends half an hour in the server room. */
export function laptopPlan(S, a) {
  const id = isFree(S, 'rack:1', a) ? 'rack:1' : 'rack:0'
  return [to(spots[id], { poi: id }), { k: 'do', act: 'tinker', left: 30, fx: 'fixed', yaw: spots[id].yaw }]
}
