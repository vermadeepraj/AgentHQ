// Plan execution. A plan is a short list of JSON steps:
//   goto   {x, z, yaw?, poi?, carry?}        walk somewhere (poi = reserved spot id)
//   work   {t, left, act}                    progress a ticket for `left` minutes
//   review {t, stage: 'review'|'qa', left}   review or test a ticket
//   do     {act, left, fx?, yaw?, carry?}    timed activity with an effect at the end
//   meet   {id, act, yaw}                    stay until meeting `id` ends
//   away   {left, fx?}                       out of the building (lunch)
//   leave  {}                                go home (caller walks to the exit first)

import { spots } from '../world/layout.js'
import { dayOf } from '../clock.js'
import { emit, say, remember } from '../events.js'
import { moveTo } from './movement.js'
import { goHome } from './lifecycle.js'
import { byId, workRate, qualityOf, finishWork, finishReview, finishQA } from '../work/tickets.js'

export const isFree = (S, poi, a) => !S.reserved[poi] || S.reserved[poi] === a.id

const claimKey = (stage) => (stage === 'qa' ? 'tester' : 'reviewer')

export function release(S, a) {
  for (const poi of a.res) if (S.reserved[poi] === a.id) delete S.reserved[poi]
  a.res = []
  for (const st of a.plan) {
    if (st.k !== 'review') continue
    const t = byId(S, st.t)
    if (t && t[claimKey(st.stage)] === a.id) t[claimKey(st.stage)] = null
  }
}

/** Replace the agent's plan, releasing old reservations and claiming new ones. */
export function setPlan(S, a, plan) {
  release(S, a)
  a.plan = plan
  a.path = null
  a.hidden = false
  for (const st of plan) {
    if (st.poi) {
      S.reserved[st.poi] = a.id
      a.res.push(st.poi)
    }
    if (st.k === 'review') byId(S, st.t)[claimKey(st.stage)] = a.id
  }
}

function advance(S, a) {
  a.plan.shift()
  a.path = null
  if (!a.plan.length) {
    release(S, a)
    a.carry = null
  }
}

/** A standing spot beside someone's desk, facing their chair. */
export function besideDesk(agent) {
  const seat = spots[`desk:${agent.desk}`]
  const px = seat.x + Math.cos(seat.yaw) * 0.7
  const pz = seat.z - Math.sin(seat.yaw) * 0.7
  return { x: px, z: pz, yaw: Math.atan2(seat.x - px, seat.z - pz) }
}

export function runPlan(S, a, dt) {
  const st = a.plan[0]
  if (!st) return
  switch (st.k) {
    case 'goto':
      if (moveTo(S, a, st)) advance(S, a)
      return
    case 'work':
      return workStep(S, a, st, dt)
    case 'review':
      return reviewStep(S, a, st, dt)
    case 'do':
      return doStep(S, a, st, dt)
    case 'meet':
      a.act = st.act
      if (st.yaw != null) a.yaw = st.yaw
      if (!S.meeting || S.meeting.id !== st.id) advance(S, a)
      return
    case 'away':
      a.hidden = true
      a.act = 'stand'
      st.left -= dt
      if (st.left <= 0) {
        a.hidden = false
        applyFx(S, a, st)
        advance(S, a)
      }
      return
    case 'leave':
      return goHome(S, a)
  }
}

function workStep(S, a, st, dt) {
  const t = byId(S, st.t)
  if (!t || t.status !== 'doing' || t.assignee !== a.id) return advance(S, a)
  a.act = st.act || 'type'
  a.ticket = t.id
  const rate = workRate(a, t.type)
  t.progress += rate * dt
  t.qW += rate * dt
  t.qS += rate * dt * qualityOf(a, t.type)
  a.focus = Math.min(1, a.focus + 0.008 * dt)
  a.stats.minutes += dt
  st.left -= dt
  if (t.progress >= t.effort) {
    finishWork(S, a, t)
    a.ticket = null
    return advance(S, a)
  }
  if (st.left <= 0) advance(S, a)
}

function reviewStep(S, a, st, dt) {
  const t = byId(S, st.t)
  if (!t || t.status !== st.stage || t[claimKey(st.stage)] !== a.id) return advance(S, a)
  a.act = 'type'
  a.ticket = t.id
  st.left -= dt * (0.6 + 0.4 * a.energy)
  if (st.left > 0) return
  a.ticket = null
  if (st.stage === 'review') finishReview(S, a, t)
  else {
    const authorId = finishQA(S, a, t)
    const author = S.agents.find((x) => x.id === authorId)
    if (author && author !== a && author.present && !author.hidden) {
      const p = besideDesk(author)
      a.plan.splice(1, 0,
        { k: 'goto', x: p.x, z: p.z, yaw: p.yaw, carry: 'doc' },
        { k: 'do', act: 'talk', left: 3, yaw: p.yaw, carry: 'doc', fx: 'bugReport', to: author.id })
    }
  }
  advance(S, a)
}

function doStep(S, a, st, dt) {
  if (!st.started) {
    st.started = true
    onStart(S, a, st)
  }
  a.act = st.act
  if (st.yaw != null) a.yaw = st.yaw
  a.carry = st.carry || null
  st.left -= dt
  if (st.left <= 0) {
    a.carry = null
    applyFx(S, a, st)
    advance(S, a)
  }
}

function onStart(S, a, st) {
  const other = st.to && S.agents.find((x) => x.id === st.to)
  if (st.fx === 'pingpong' && st.partner) {
    const p = S.agents.find((x) => x.id === st.partner)
    if (p && p.plan[0]?.waitPP) {
      p.plan[0] = { k: 'do', act: 'pingpong', left: st.left, fx: 'pingpong', yaw: p.plan[0].yaw, started: true }
      say(S, p, 'Game on 🏓')
    }
  }
  if (st.fx === 'handoff' && other) {
    emit(S, 'handoff', { from: a.id, to: other.id, ticket: st.ticket })
    say(S, a, 'Here are the designs 📐')
    say(S, other, 'Love it, thanks!')
  }
  if (st.fx === 'bugReport' && other) {
    say(S, other, 'Ugh, fixing it 😩')
  }
  if (st.fx === 'coffee') say(S, a, '☕')
}

const bump = (a, key, v) => (a[key] = Math.min(1, Math.max(0, a[key] + v)))

function applyFx(S, a, st) {
  switch (st.fx) {
    case 'coffee':
      bump(a, 'energy', 0.3)
      a.stats.coffees++
      a.coffeeDay = dayOf(S.clock)
      S.stats.coffees++
      break
    case 'water':
      bump(a, 'energy', 0.08)
      bump(a, 'morale', 0.02)
      break
    case 'lunch':
      bump(a, 'energy', 0.22)
      bump(a, 'morale', 0.04)
      break
    case 'pizza':
      bump(a, 'energy', 0.2)
      bump(a, 'morale', 0.12)
      remember(S, a, 'Free pizza 🍕')
      break
    case 'lounge':
      bump(a, 'morale', 0.08)
      bump(a, 'energy', 0.06)
      break
    case 'pingpong':
      bump(a, 'morale', 0.15)
      break
    case 'handoff':
      S.stats.handoffs++
      remember(S, a, 'Handed designs to engineering')
      break
    case 'fixed':
      say(S, a, 'Back in business 💻')
      break
  }
}
