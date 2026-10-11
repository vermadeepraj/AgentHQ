// Scripted brain: utility AI. Every option gets a score; the best one wins.
// The top three are stored on the agent so the inspector can show *why*.
// Same interface a future LLM brain will implement: decide(S, agent) → plan.

import { rand } from '../rng.js'
import { minuteOfDay, dayOf } from '../clock.js'
import { CRUNCH_EXTRA } from '../constants.js'
import { say } from '../events.js'
import { myDoing, availableFor, specialistAvailable, reviewableFor, testableFor, ticketFit, startTicket } from '../work/tickets.js'
import * as act from './actions.js'

function pressure(S) {
  const { start, deadline } = S.scenario
  return Math.min(1, Math.max(0, (S.clock - start) / Math.max(1, deadline - start)))
}

export function shouldGoHome(S, a) {
  if (S.outage?.active && a.paged) return false
  const m = minuteOfDay(S.clock)
  if (a.paged && m < 7 * 60) return true // incident over, back to bed
  if (m < 6 * 60) return true // still here after midnight
  if (m < 12 * 60) return false
  return m >= a.leaveMin + (S.crunch ? CRUNCH_EXTRA : 0)
}

export function decide(S, a) {
  const options = []
  const add = (score, label, build) => options.push({ score: score + rand(S) * 0.04, label, build })
  const p = pressure(S)
  const m = minuteOfDay(S.clock)

  if (a.energy < 0.05) add(3, 'Running on empty — going home', () => act.leavePlan(S, a, true))
  if (shouldGoHome(S, a)) add(2, 'Day is done — heading home', () => act.leavePlan(S, a))

  if (a.inbox.length) {
    const item = a.inbox[0]
    add(0.78, 'Hand the designs over in person', () => {
      a.inbox.shift()
      return act.handoffPlan(S, a, item)
    })
  }

  const mine = myDoing(S, a)
  if (mine) {
    const label = mine.reworks ? `Fix the bug in ${mine.id}` : `Keep going on ${mine.id} ${mine.title}`
    add(0.62 + 0.12 * p + 0.1 * a.focus + (mine.reworks ? 0.05 : 0), label, () => act.workPlan(S, a, mine))
  } else {
    let best = null
    for (const t of availableFor(S, a)) {
      if (specialistAvailable(S, a, t)) continue
      const fit = ticketFit(a, t)
      if (!best || fit > best.fit) best = { t, fit }
    }
    if (best) {
      add(0.58 + 0.1 * p + 0.3 * best.fit, `Pick up ${best.t.id} ${best.t.title}`, () => {
        startTicket(S, a, best.t)
        say(S, a, `On it: ${best.t.title}`)
        return act.workPlan(S, a, best.t)
      })
    }
  }

  const review = reviewableFor(S, a)[0]
  if (review) add(0.66 + (a.lead ? 0.1 : 0) + 0.1 * p, `Review ${review.id} ${review.title}`, () => act.reviewPlan(S, a, review, 'review'))
  const test = testableFor(S, a)[0]
  if (test) add(0.7 + 0.1 * p, `Test ${test.id} ${test.title}`, () => act.reviewPlan(S, a, test, 'qa'))

  add(1.3 * Math.pow(1 - a.energy, 1.6), `Energy ${Math.round(a.energy * 100)}% — coffee`, () => act.coffeePlan(S, a))
  if (m >= 8 * 60 && m < 10.5 * 60 && !a.paged && a.coffeeDay !== dayOf(S.clock)) add(0.68, 'Morning coffee first', () => act.coffeePlan(S, a))
  if (m >= 12.25 * 60 && m <= 13.75 * 60 && a.lunchDay !== dayOf(S.clock)) add(0.85, 'Lunch time', () => act.lunchPlan(S, a))
  if (S.pizzaUntil > S.clock && a.pizzaId !== S.pizzaId) add(0.8 + 0.2 * (1 - a.energy), 'Free pizza!', () => act.pizzaPlan(S, a))
  add(1.1 * Math.pow(1 - a.morale, 1.8), `Morale ${Math.round(a.morale * 100)}% — take a break`, () => act.breakPlan(S, a))
  add(0.2, 'Nothing urgent — catching up on Slack', () => act.idlePlan(S, a))

  options.sort((x, y) => y.score - x.score)
  a.why = options.slice(0, 3).map((o) => ({ label: o.label, score: Math.round(o.score * 100) / 100 }))
  for (const o of options) {
    const plan = o.build()
    if (plan && plan.length) {
      a.thought = o.label
      return plan
    }
  }
  return act.idlePlan(S, a)
}
