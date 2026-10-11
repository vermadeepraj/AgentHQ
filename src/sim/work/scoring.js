// Final grading. Delivery scenarios: on time 40, early 10, quality 20, budget 15,
// morale 15 (minus client dissatisfaction). Outage: downtime-driven.

import { fmtDuration } from '../clock.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

function grade(score, result) {
  if (result === 'fail') return 'F'
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

export function computeOutcome(S, result) {
  const visible = S.tickets.filter((t) => t.status !== 'hidden')
  const done = visible.filter((t) => t.status === 'done')
  const quality = mean(done.map((t) => t.quality))
  const morale = mean(S.agents.map((a) => a.morale))
  const budget = clamp01(S.budget / S.budget0)
  const breakdown = []
  const add = (label, value, max) => breakdown.push({ label, value: Math.round(value), max })

  if (S.scenario.kind === 'outage') {
    const downtime = (S.outage.resolvedAt ?? S.clock) - (S.outage.since ?? S.clock)
    add('Downtime', 50 * clamp01(1 - (downtime - 150) / 240), 50)
    add('Fix quality', 15 * quality, 15)
    add('Budget left', 20 * budget, 20)
    add('Team morale', 15 * morale, 15)
  } else {
    const onTime = result === 'win'
    add('Delivery', onTime ? 40 : 25 * (done.length / Math.max(1, visible.length)), 40)
    add('Shipped early', onTime ? 10 * clamp01((S.scenario.deadline - S.launchedAt) / 480) : 0, 10)
    add('Quality', 20 * quality, 20)
    add('Budget left', 15 * budget, 15)
    add('Team morale', 15 * morale, 15)
    if (S.clientSat < 1) add('Client happiness', -20 * (1 - S.clientSat), 0)
  }
  const score = Math.max(0, Math.min(100, breakdown.reduce((s, b) => s + b.value, 0)))
  const downtime = S.outage ? (S.outage.resolvedAt ?? S.clock) - (S.outage.since ?? S.clock) : null
  return {
    result, score, grade: grade(score, result), breakdown, clock: S.clock,
    summary: summaryLine(S, result, downtime),
    stats: {
      ticketsDone: done.length, tickets: visible.length, bugs: S.stats.bugs, reviews: S.stats.reviews,
      coffees: S.stats.coffees, spent: Math.round(S.spent), loss: Math.round(S.loss),
      quality: Math.round(quality * 100), morale: Math.round(morale * 100), downtime,
    },
  }
}

function summaryLine(S, result, downtime) {
  if (S.scenario.kind === 'outage') {
    return result === 'win'
      ? `Service restored after ${fmtDuration(downtime)}. Postmortem filed.`
      : 'The postmortem never got written. The board is asking questions.'
  }
  return result === 'win'
    ? `${S.scenario.client} is live — ${S.stats.bugs} bug${S.stats.bugs === 1 ? "" : "s"} caught before users ever saw ${S.stats.bugs === 1 ? "it" : "them"}.`
    : `The deadline passed with ${S.scenario.client} still unfinished.`
}
