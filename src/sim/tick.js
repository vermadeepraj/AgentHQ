// One simulation tick. Order matters — see docs/PLAN.md §5.

import { MIN_PER_TICK, NIGHT_MIN_PER_TICK } from './constants.js'
import { dayOf, minuteOfDay, fmtClock, fmtDuration } from './clock.js'
import { emit, log, say } from './events.js'
import { applyCommand } from './commands.js'
import { updateNeeds, isOvertime } from './agents/needs.js'
import { arrive, page } from './agents/lifecycle.js'
import { setPlan, runPlan } from './agents/plans.js'
import { decide } from './brains/scripted.js'
import { startMeeting, updateMeeting } from './work/meetings.js'
import { revealTickets } from './work/tickets.js'
import { computeOutcome } from './work/scoring.js'

const presentIds = (S) => S.agents.filter((a) => a.present && !a.hidden).map((a) => a.id)

export function step(S, cmds = []) {
  S.events = []
  for (const c of cmds) applyCommand(S, c)
  if (S.decision) {
    S.tick++ // the world is frozen until the player decides
    return S
  }
  const dt = S.agents.some((a) => a.present) || S.outage?.active ? MIN_PER_TICK : NIGHT_MIN_PER_TICK
  S.clock = Math.round((S.clock + dt) * 1000) / 1000

  runSchedule(S)
  routines(S)
  if (S.meeting) updateMeeting(S)

  for (const a of S.agents) {
    if (!a.present) {
      if (a.arriveAt < 0 || S.clock < a.arriveAt) continue
      arrive(S, a)
    }
    updateNeeds(S, a, dt)
    if (!a.plan.length) setPlan(S, a, decide(S, a))
    runPlan(S, a, dt)
    if (S.hooks.length) runHooks(S)
  }
  if (S.hooks.length) runHooks(S)

  economy(S, dt)
  checkEnd(S)
  S.tick++
  return S
}

// ── Scheduled scenario events ──────────────────────────────────────────
function runSchedule(S) {
  for (const e of S.schedule) {
    if (e.done || S.clock < e.at) continue
    e.done = true
    if (e.kind === 'kickoff') kickoff(S)
    else if (e.kind === 'alarm') alarm(S)
    else if (e.kind === 'page') page(S, S.agents.find((a) => a.id === e.agent), e.delay)
    else if (e.kind === 'decision') {
      const d = S.decisions[e.decision]
      S.decision = { id: e.decision, title: d.title, text: d.text, options: d.options.map(({ id, label, hint }) => ({ id, label, hint })) }
      emit(S, 'decision', { id: e.decision })
      log(S, `📞 ${d.title}`, 'bad')
    }
  }
}

function kickoff(S) {
  const pick = (pred) => S.agents.filter((a) => a.present && pred(a)).map((a) => a.id)
  const firstDesigner = S.agents.find((a) => a.team === 'design')?.id
  const ids = pick((a) => a.team === 'product' || a.lead || a.id === firstDesigner || a.team === 'qa' || a.team === 'ops')
  const pm = S.agents.find((a) => a.reviews.includes('design'))
  startMeeting(S, 'kickoff', ids, { presenter: pm?.id, lines: kickoffLines(S) })
}

function kickoffLines(S) {
  const titles = (type) => S.tickets.filter((t) => t.type === type && !t.launch).map((t) => t.title)
  const line = (label, type) => {
    const list = titles(type)
    return list.length ? `${label}: ${list.slice(0, 3).join(' · ')}${list.length > 3 ? ` +${list.length - 3}` : ''}` : null
  }
  return [
    `GOAL — ${S.scenario.client}`,
    line('Product', 'product'),
    line('Design', 'design'),
    line('Backend', 'backend'),
    line('Frontend', 'frontend'),
    line('Ops', 'ops'),
    `SHIP BY ${fmtClock(S.scenario.deadline).toUpperCase()}`,
  ].filter(Boolean)
}

function alarm(S) {
  S.outage.active = true
  S.outage.since = S.clock
  revealTickets(S)
  emit(S, 'alarm')
  log(S, '🚨 Pager: checkout is down in production', 'bad')
}

// ── Daily routines ─────────────────────────────────────────────────────
function routines(S) {
  const m = minuteOfDay(S.clock)
  const day = dayOf(S.clock)
  if (S.phase === 'build' && !S.meeting && day > dayOf(S.scenario.start) && S.standupDay !== day && m >= 9.5 * 60 && m < 11 * 60) {
    S.standupDay = day
    const ids = presentIds(S)
    if (ids.length >= 3) startMeeting(S, 'standup', ids)
  }
  const o = S.outage
  if (o?.active && !o.escalated && S.clock - o.since > 90) {
    o.escalated = true
    const covered = S.agents.some((a) => (a.skills.backend || 0) >= 0.7 && (a.present || a.paged))
    const lead = S.agents.find((a) => a.lead)
    if (!covered && lead && page(S, lead, 25)) log(S, `On-call escalated to ${lead.first}`, 'info', lead.id)
  }
}

// ── Deferred consequences raised by ticket transitions and meetings ─────
function runHooks(S) {
  const hooks = S.hooks
  S.hooks = []
  for (const h of hooks) {
    if (h.type === 'launch') {
      S.launchedAt = S.clock
      S.phase = 'launched'
      const by = S.agents.find((a) => a.id === h.agent)
      if (by) say(S, by, 'It’s live! 🚀')
      for (const a of S.agents) a.morale = Math.min(1, a.morale + 0.15)
      emit(S, 'deployed', { agent: h.agent })
      log(S, `🚀 ${S.scenario.client} is live!`, 'good')
      startMeeting(S, 'celebrate', presentIds(S))
      if (!S.meeting) finish(S, 'win')
    } else if (h.type === 'resolve') {
      S.outage.active = false
      S.outage.resolvedAt = S.clock
      emit(S, 'resolved')
      log(S, `✅ Checkout is back up after ${fmtDuration(S.clock - S.outage.since)}`, 'good')
    } else if (h.type === 'finish') {
      finish(S, S.scenario.kind === 'outage' || S.launchedAt <= S.scenario.deadline ? 'win' : 'fail')
    }
  }
}

function finish(S, result) {
  if (S.outcome) return
  S.outcome = computeOutcome(S, result)
  S.phase = 'over'
  emit(S, 'outcome', { result, grade: S.outcome.grade })
  log(S, `Project ${result === 'win' ? 'complete' : 'failed'} — grade ${S.outcome.grade}`, result === 'win' ? 'good' : 'bad')
}

function economy(S, dt) {
  const overtime = isOvertime(S.clock)
  for (const a of S.agents) {
    if (!a.present) continue
    const mult = a.paged && overtime ? 2 : overtime ? 1.5 : 1
    const cost = (a.rate / 60) * dt * mult
    S.spent += cost
    S.budget -= cost
  }
  if (S.outage?.active) {
    const loss = S.outage.perMin * dt
    S.loss += loss
    S.budget -= loss
  }
}

function checkEnd(S) {
  if (S.outcome || S.clock < S.scenario.deadline) return
  if (S.scenario.kind === 'outage' || !S.launchedAt) finish(S, 'fail')
}
