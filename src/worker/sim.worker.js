// Hosts the simulation off the main thread. Protocol (docs/PLAN.md §9):
//   in:  init {scenario, seed, brief, plan, speed} · cmd {cmd} · speed {value} · pause {value} · seek {tick}
//   out: frame {tick, maxTick, paused, speed, state, events}   (~20 Hz)

import { Timeline } from '../sim/timeline.js'
import { TICKS_PER_SECOND } from '../sim/constants.js'

const FRAME_MS = 1000 / TICKS_PER_SECOND

let tl = null
let speed = 1
let paused = false
let events = []
let dirty = true

function view(S) {
  return {
    tick: S.tick, clock: S.clock, phase: S.phase, scenario: S.scenario,
    budget: S.budget, budget0: S.budget0, spent: S.spent, loss: S.loss, crunch: S.crunch,
    pizzaUntil: S.pizzaUntil, coffeeBrokenUntil: S.coffeeBrokenUntil, meeting: S.meeting,
    whiteboard: S.whiteboard, decision: S.decision, outage: S.outage, outcome: S.outcome,
    launchedAt: S.launchedAt, clientSat: S.clientSat, hires: S.hires, stats: S.stats,
    feed: S.feed.slice(-40),
    agents: S.agents.map((a) => ({
      id: a.id, name: a.name, first: a.first, role: a.role, team: a.team, look: a.look, desk: a.desk,
      contractor: a.contractor, trait: a.trait, skills: a.skills, primary: a.primary,
      x: a.x, z: a.z, yaw: a.yaw, present: a.present, hidden: a.hidden, act: a.act, carry: a.carry,
      say: a.say, sayId: a.sayId, energy: a.energy, morale: a.morale, focus: a.focus,
      ticket: a.ticket, thought: a.thought, why: a.why, memory: a.memory, stats: a.stats,
      paged: a.paged, burnout: a.burnout, arriveAt: a.arriveAt, step: a.plan[0]?.k || null,
    })),
    tickets: S.tickets
      .filter((t) => t.status !== 'hidden')
      .map((t) => ({
        id: t.id, key: t.key, title: t.title, type: t.type, status: t.status, progress: t.progress,
        effort: t.effort, assignee: t.assignee, reviewer: t.reviewer, tester: t.tester,
        reworks: t.reworks, quality: t.quality, pri: t.pri, deps: t.deps, launch: t.launch,
      })),
  }
}

function post() {
  const S = tl.S
  postMessage({ type: 'frame', tick: S.tick, maxTick: tl.maxTick, paused, speed, state: view(S), events })
  events = []
  dirty = false
}

function loop() {
  if (!tl) return
  const waiting = tl.S.decision && !tl.hasPending()
  if (!paused && !waiting) {
    for (let i = 0; i < speed; i++) {
      events.push(...tl.step())
      if (tl.S.decision && !tl.hasPending()) break
    }
    dirty = true
  }
  if (dirty) post()
}

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      tl = new Timeline(data.scenario, { seed: data.seed ?? 1, brief: data.brief ?? '', plan: data.plan ?? null })
      speed = data.speed ?? 1
      paused = !!data.paused
      events = []
      dirty = true
      break
    case 'cmd':
      if (!tl) return
      tl.push(data.cmd)
      if (paused || tl.S.decision) events.push(...tl.step()) // apply immediately even when paused
      dirty = true
      break
    case 'speed':
      speed = data.value
      dirty = true
      break
    case 'pause':
      paused = data.value
      dirty = true
      break
    case 'seek':
      if (!tl) return
      tl.seek(data.tick)
      events = []
      dirty = true
      break
  }
  if (dirty && tl) post()
}

setInterval(loop, FRAME_MS)
