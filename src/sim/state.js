// Builds the initial world state S for a scenario. S is plain JSON (see CLAUDE.md).

import { getScenario } from './scenarios/index.js'
import { ROSTER } from './agents/roster.js'
import { makeAgent } from './agents/lifecycle.js'
import { makeTickets, recountDependents } from './work/tickets.js'
import { log } from './events.js'

export function createState(scenarioId, { seed = 1, brief = '', plan = null } = {}) {
  const sc = getScenario(scenarioId, { brief, plan })
  const S = {
    version: 1,
    tick: 0,
    seed,
    rng: seed >>> 0 || 1,
    clock: sc.start,
    seq: 1,
    nextTicket: 101,
    scenario: {
      id: sc.id, title: sc.title, client: sc.client, brief: sc.brief, difficulty: sc.difficulty,
      start: sc.start, deadline: sc.deadline, kind: sc.scoring, site: sc.site, aiPlanned: !!sc.aiPlanned,
    },
    phase: sc.kickoff ? 'kickoff' : 'build',
    agents: [],
    tickets: [],
    budget: sc.budget,
    budget0: sc.budget,
    spent: 0,
    loss: 0,
    crunch: false,
    pizzaUntil: -1,
    pizzaId: 0,
    coffeeBrokenUntil: -1,
    meeting: null,
    whiteboard: [],
    reserved: {},
    feed: [],
    events: [],
    hooks: [],
    decision: null,
    decisions: sc.decisions || {},
    schedule: (sc.events || []).map((e) => ({ ...e, done: false })),
    outage: sc.outage ? { active: false, since: null, resolvedAt: null, perMin: sc.outage.revenuePerMin, escalated: false } : null,
    finishOn: sc.finishOn || null,
    launchedAt: null,
    outcome: null,
    clientSat: 1,
    hires: 0,
    standupDay: 0,
    stats: { bugs: 0, reviews: 0, coffees: 0, meetings: 0, handoffs: 0, pizzas: 0, chaos: 0 },
  }
  S.tickets = makeTickets(S, sc.tickets, sc.kickoff ? 'hidden' : 'todo')
  if (sc.kickoff || sc.outage) for (const t of S.tickets) t.status = 'hidden'
  recountDependents(S)
  for (const def of ROSTER) S.agents.push(makeAgent(S, def, def.desk))
  if (sc.kickoff) S.schedule.push({ at: sc.start + 2, kind: 'kickoff', done: false })
  log(S, `New project: ${sc.brief}`, 'info')
  return S
}
