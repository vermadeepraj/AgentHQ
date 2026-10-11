// Tickets: creation, queries, work/quality maths and stage transitions.
// Flow: todo → doing → (review) → (qa) → done. See docs/PLAN.md §5.

import { rand } from '../rng.js'
import { emit, log, say, remember } from '../events.js'
import { WORK_SPEED } from '../constants.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/** Build ticket objects from scenario tuples. `'*'` in deps means "every other ticket". */
export function makeTickets(S, tuples, status) {
  const made = tuples.map(([key, title, type, effort, deps, pri, flags = {}]) => ({
    id: `#${S.nextTicket++}`, key, title, type, effort, pri, deps, status,
    progress: 0, assignee: null, author: null, reviewer: null, tester: null,
    qW: 0, qS: 0, quality: 0, reworks: 0, dependents: 0, startedAt: null, doneAt: null,
    fast: !!flags.fast, resolves: !!flags.resolves, launch: !!flags.launch,
  }))
  const all = [...S.tickets, ...made]
  for (const t of made) {
    t.deps = t.deps.includes('*')
      ? all.filter((o) => o !== t && !o.launch).map((o) => o.id)
      : t.deps.map((k) => all.find((o) => o.key === k)?.id).filter(Boolean)
  }
  return made
}

export function recountDependents(S) {
  for (const t of S.tickets) t.dependents = 0
  for (const t of S.tickets) for (const d of t.deps) byId(S, d).dependents++
}

export const byId = (S, id) => S.tickets.find((t) => t.id === id)
export const depsDone = (S, t) => t.deps.every((d) => byId(S, d)?.status === 'done')
export const skillFor = (a, type) => a.skills[type] || 0
export const myDoing = (S, a) => S.tickets.find((t) => t.assignee === a.id && t.status === 'doing')

export function workRate(a, type) {
  return skillFor(a, type) * (0.5 + 0.5 * a.focus) * (0.55 + 0.45 * a.energy) * (0.75 + 0.25 * a.morale) * a.speed * WORK_SPEED
}

export function qualityOf(a, type) {
  return clamp01(skillFor(a, type) * (0.7 + 0.3 * a.energy) * (0.85 + 0.15 * a.morale) * a.quality)
}

// ── Queries used by the brain ──────────────────────────────────────────
export function availableFor(S, a) {
  return S.tickets.filter(
    (t) =>
      t.status === 'todo' && depsDone(S, t) &&
      (t.assignee === a.id ? skillFor(a, t.type) > 0 : !t.assignee && skillFor(a, t.type) >= 0.45),
  )
}

/** True if a free specialist for this ticket's type is in the office — non-specialists leave it to them. */
export function specialistAvailable(S, a, t) {
  if (t.type === a.primary || t.assignee === a.id) return false
  return S.agents.some((o) => o !== a && o.present && o.primary === t.type && !myDoing(S, o))
}

export function canReview(a, t) {
  if (t.type === 'design' || t.type === 'product') return (a.reviews || []).includes(t.type)
  return a.team === 'eng' && skillFor(a, t.type) >= 0.6
}

export const reviewableFor = (S, a) =>
  S.tickets.filter((t) => t.status === 'review' && !t.reviewer && t.author !== a.id && canReview(a, t))

export const testableFor = (S, a) =>
  (a.skills.qa || 0) >= 0.6 ? S.tickets.filter((t) => t.status === 'qa' && !t.tester) : []

/** How attractive a ticket is for this agent (0..~1). */
export function ticketFit(a, t) {
  return t.pri * 0.1 + Math.min(t.dependents, 6) * 0.04 + (t.type === a.primary ? 0.15 : -0.1) + skillFor(a, t.type) * 0.2
}

// ── Transitions ────────────────────────────────────────────────────────
export function startTicket(S, a, t) {
  t.assignee = a.id
  t.status = 'doing'
  if (!t.author) t.author = a.id
  if (t.startedAt == null) t.startedAt = S.clock
  emit(S, 'ticketStage', { ticket: t.id, status: 'doing', agent: a.id })
  log(S, `${a.first} started ${t.id} ${t.title}`, 'work', a.id)
}

/** Called by the work step when progress reaches effort. */
export function finishWork(S, a, t) {
  t.progress = t.effort
  t.quality = t.qW ? clamp01(t.qS / t.qW) : 0.5
  a.stats.done++
  remember(S, a, `Finished ${t.title}`)
  if (t.launch) return markDone(S, t, a)
  if (t.fast || t.type === 'product' || t.type === 'ops') return markDone(S, t, a)
  if (t.reworks && t.type !== 'design') {
    // A bug fix goes straight back to QA — no second code review.
    t.status = 'qa'
    say(S, a, 'Fixed — back to QA 🔁')
    emit(S, 'ticketStage', { ticket: t.id, status: 'qa', agent: a.id })
    log(S, `${a.first} fixed ${t.id} — back to QA`, 'work', a.id)
    return
  }
  t.status = 'review'
  say(S, a, 'Ready for review 👀')
  emit(S, 'ticketStage', { ticket: t.id, status: 'review', agent: a.id })
  log(S, `${t.id} ${t.title} is ready for review`, 'work', a.id)
}

export function finishReview(S, a, t) {
  t.reviewer = null
  t.quality = clamp01(t.quality + 0.04)
  a.stats.reviews++
  S.stats.reviews++
  say(S, a, 'LGTM ✅')
  emit(S, 'ping', { from: a.id, to: t.author, kind: 'review' })
  if (t.type === 'design' || t.type === 'product') return markDone(S, t, a)
  t.status = 'qa'
  emit(S, 'ticketStage', { ticket: t.id, status: 'qa', agent: a.id })
  log(S, `${a.first} approved ${t.id} — off to QA`, 'work', a.id)
}

/** Returns the author id if the build was rejected (caller adds the walk-over). */
export function finishQA(S, a, t) {
  t.tester = null
  a.stats.tests++
  const pBug = Math.min(0.6, Math.max(0.05, 1.3 * (1 - t.quality) - 0.05)) * (t.reworks >= 2 ? 0.3 : 1)
  if (rand(S) < pBug) {
    t.status = 'doing'
    t.progress = t.effort * 0.72
    t.reworks++
    t.qS += t.qW * 0.12 // fixing bugs makes the work better
    S.stats.bugs++
    const author = S.agents.find((x) => x.id === t.author)
    if (author) {
      author.morale = Math.max(0, author.morale - 0.05)
      author.stats.reworks++
      remember(S, author, `QA bounced ${t.title}`)
    }
    say(S, a, 'Found a bug 🐞')
    emit(S, 'qaReject', { ticket: t.id, from: a.id, to: t.author })
    log(S, `${a.first} found a bug in ${t.id} ${t.title}`, 'bad', a.id)
    return t.author
  }
  say(S, a, 'Passed QA ✅')
  emit(S, 'qaPass', { ticket: t.id, from: a.id })
  markDone(S, t, a)
  return null
}

export function markDone(S, t, by) {
  t.status = 'done'
  t.doneAt = S.clock
  t.assignee = t.assignee || by.id
  emit(S, 'ticketStage', { ticket: t.id, status: 'done', agent: by.id })
  if (t.launch) return S.hooks.push({ type: 'launch', agent: by.id })
  log(S, `${t.id} ${t.title} is done`, 'good', by.id)
  if (t.resolves) S.hooks.push({ type: 'resolve', agent: by.id })
  if (S.finishOn && t.key === S.finishOn) S.hooks.push({ type: 'finish' })
  if (t.type === 'design') queueHandoff(S, t)
}

/** A finished design gets walked over to a frontend engineer. */
function queueHandoff(S, t) {
  const author = S.agents.find((a) => a.id === t.author)
  if (!author) return
  const next = S.tickets.find((o) => o.type === 'frontend' && o.deps.includes(t.id) && o.assignee)
  const to = next ? next.assignee : S.agents.find((a) => a.primary === 'frontend' && a.present)?.id
  if (to && to !== author.id) author.inbox.push({ kind: 'handoff', to, ticket: t.id })
}

export function revealTickets(S) {
  let n = 0
  for (const t of S.tickets) if (t.status === 'hidden') (t.status = 'todo'), n++
  if (n) {
    emit(S, 'ticketsCreated', { count: n })
    log(S, `${n} tickets added to the board`, 'info')
  }
}
