// Player commands — the only way the outside world changes S.
// Every command is recorded by the Timeline with its tick (replays depend on it).

import { PRICES, MAX_HIRES } from './constants.js'
import { minuteOfDay, nextAt } from './clock.js'
import { WORK_START } from './constants.js'
import { pick, randInt } from './rng.js'
import { emit, log, say, remember } from './events.js'
import { desks } from './world/layout.js'
import { CONTRACTORS, CONTRACTOR_PEOPLE } from './agents/roster.js'
import { makeAgent, page } from './agents/lifecycle.js'
import { setPlan } from './agents/plans.js'
import * as act from './brains/actions.js'
import { startMeeting } from './work/meetings.js'
import { byId, depsDone, skillFor, startTicket, makeTickets, recountDependents } from './work/tickets.js'

/** A direct order overrides the utility scores — show that in the inspector instead of stale ones. */
function ceoOrder(a, label) {
  a.thought = label
  a.why = [{ label: `${label} (overrides scores)`, score: 1 }]
}

const spend = (S, amount) => {
  S.budget -= amount
  S.spent += amount
}

export function applyCommand(S, c) {
  const agent = c.agent ? S.agents.find((a) => a.id === c.agent) : null
  switch (c.type) {
    case 'assign': return assign(S, byId(S, c.ticket), agent)
    case 'pizza': return pizza(S)
    case 'allhands': return void startMeeting(S, 'allhands', S.agents.filter((a) => a.present && !a.hidden).map((a) => a.id))
    case 'hire': return hire(S, c.role)
    case 'crunch': return crunch(S, !!c.on)
    case 'chaos': return chaos(S, c.kind)
    case 'break': return sendOnBreak(S, agent)
    case 'sendHome':
      if (!agent?.present) return
      setPlan(S, agent, act.leavePlan(S, agent))
      ceoOrder(agent, 'The CEO sent me home')
      return
    case 'page':
      if (agent) page(S, agent)
      return
    case 'decide': return decide(S, c.id, c.option)
    case 'voice': return voice(S, agent, c)
  }
}

/** The CEO spoke to an agent and they answered (reply written by Claude or the offline brain). */
function voice(S, a, c) {
  if (!a) return
  const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
  const heard = clip(c.heard, 200)
  const reply = clip(c.say, 160)
  if (heard) {
    remember(S, a, `CEO: “${heard}”`)
    log(S, `CEO → ${a.first}: “${heard}”`, 'ceo', a.id)
  }
  if (reply) {
    say(S, a, reply)
    remember(S, a, `Me: “${reply}”`)
  }
  if (c.thought) a.thought = clip(c.thought, 90)
}

function assign(S, t, a) {
  if (!t || !a || !['todo', 'doing'].includes(t.status) || skillFor(a, t.type) <= 0) return
  const other = S.tickets.find((o) => o !== t && o.assignee === a.id && o.status === 'doing')
  if (other) {
    other.status = 'todo'
    other.assignee = null
  }
  t.assignee = a.id
  remember(S, a, `CEO assigned me ${t.title}`)
  if (depsDone(S, t) && a.present) {
    if (t.status !== 'doing') startTicket(S, a, t)
    t.author = t.author || a.id
    setPlan(S, a, act.workPlan(S, a, t))
    ceoOrder(a, `CEO asked me to do ${t.id}`)
    say(S, a, 'On it, boss 👍')
  } else {
    t.status = 'todo'
  }
  log(S, `CEO assigned ${t.id} to ${a.first}`, 'ceo', a.id)
}

function pizza(S) {
  spend(S, PRICES.pizza)
  S.pizzaUntil = S.clock + 90
  S.pizzaId++
  S.stats.pizzas++
  emit(S, 'pizza')
  log(S, '🍕 Pizza has arrived in the kitchen', 'ceo')
}

function hire(S, role) {
  const tpl = CONTRACTORS[role]
  if (!tpl || S.hires >= MAX_HIRES) return
  const taken = new Set(S.agents.map((a) => a.desk))
  const free = Object.values(desks).filter((d) => !taken.has(d.id))
  const desk = free.find((d) => d.team === tpl.team) || free.find((d) => d.group === 'eng')
  if (!desk) return
  const person = CONTRACTOR_PEOPLE[S.hires % CONTRACTOR_PEOPLE.length]
  S.hires++
  const def = { id: `contractor-${S.hires}`, name: person.name, look: person.look, speed: 1, quality: 0.95, trait: 'Hired gun', ...tpl }
  const a = makeAgent(S, def, desk.id, { present: false, contractor: true })
  const m = minuteOfDay(S.clock)
  a.arriveAt = m >= 8 * 60 && m < 17 * 60 ? S.clock + randInt(S, 8, 15) : nextAt(S.clock, WORK_START)
  S.agents.push(a)
  spend(S, PRICES.hire)
  emit(S, 'hire', { agent: a.id })
  log(S, `Hired ${person.name} (${tpl.role})`, 'ceo', a.id)
}

function crunch(S, on) {
  if (S.crunch === on) return
  S.crunch = on
  if (on) for (const a of S.agents) a.morale = Math.max(0, a.morale - 0.03)
  emit(S, 'crunch', { on })
  log(S, on ? '🔥 Crunch mode on — everyone stays late' : 'Crunch mode off', 'ceo')
}

function sendOnBreak(S, a) {
  if (!a?.present || a.hidden) return
  const plan = act.breakPlan(S, a) || act.coffeePlan(S, a)
  if (!plan) return
  setPlan(S, a, plan)
  ceoOrder(a, 'The CEO told me to take a break')
  say(S, a, 'Don’t mind if I do 😌')
}

function chaos(S, kind) {
  kind = kind || pick(S, ['drill', 'coffee', 'laptop', 'viral'])
  S.stats.chaos++
  const present = S.agents.filter((a) => a.present && !a.hidden)
  if (kind === 'drill') {
    startMeeting(S, 'drill', present.map((a) => a.id))
  } else if (kind === 'coffee') {
    S.coffeeBrokenUntil = S.clock + 180
    log(S, '☕ The coffee machine broke. Morale incoming…', 'bad')
  } else if (kind === 'laptop') {
    const eng = present.filter((a) => a.team === 'eng')
    if (!eng.length) return
    const v = pick(S, eng)
    setPlan(S, v, act.laptopPlan(S, v))
    v.thought = 'My laptop died'
    say(S, v, 'My laptop died 💀')
    log(S, `💀 ${v.first}'s laptop died`, 'bad', v.id)
  } else if (kind === 'viral') {
    for (const a of present) a.morale = Math.min(1, a.morale + 0.1)
    present.slice(0, 3).forEach((a) => say(S, a, 'We’re trending! 📈'))
    log(S, '📈 A tweet about the team went viral', 'good')
  }
  emit(S, 'chaos', { kind })
}

function decide(S, id, optionId) {
  if (!S.decision || S.decision.id !== id) return
  const def = S.decisions[id]
  const opt = def.options.find((o) => o.id === optionId) || def.options.find((o) => o.id === def.default)
  const fx = opt.effects
  if (fx.add?.length) {
    const added = makeTickets(S, fx.add, 'todo')
    S.tickets.push(...added)
    const launch = S.tickets.find((t) => t.launch && t.status !== 'done')
    if (launch) launch.deps.push(...added.map((t) => t.id))
    recountDependents(S)
    log(S, `${added.length} new ticket${added.length > 1 ? 's' : ''} added`, 'info')
  }
  if (fx.reopen) {
    const t = S.tickets.find((x) => x.key === fx.reopen)
    if (t && t.status !== 'todo') {
      t.status = 'todo'
      t.progress = t.effort * 0.5
      t.assignee = null
      t.qW /= 2
      t.qS /= 2
      log(S, `${t.id} ${t.title} was reopened`, 'bad')
    }
  }
  if (fx.clientSat) S.clientSat = Math.min(1, Math.max(0, S.clientSat + fx.clientSat))
  if (fx.morale) for (const a of S.agents) a.morale = Math.min(1, Math.max(0, a.morale + fx.morale))
  S.decision = null
  emit(S, 'decided', { id, option: opt.id })
  log(S, `CEO decision: ${opt.label}`, 'ceo')
}
