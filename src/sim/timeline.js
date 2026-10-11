// Timeline: records player commands by tick and snapshots S periodically, so any
// moment can be revisited by restoring a snapshot and replaying. Commands issued
// after a rewind discard the old future (branching).

import { SNAPSHOT_EVERY } from './constants.js'
import { createState } from './state.js'
import { step } from './tick.js'

const clone = (o) => structuredClone(o)

export class Timeline {
  constructor(scenarioId, opts = {}) {
    this.scenarioId = scenarioId
    this.opts = { seed: 1, brief: '', ...opts }
    this.S = createState(scenarioId, this.opts)
    this.cmds = new Map() // tick → command[]
    this.snaps = [clone(this.S)]
    this.maxTick = 0
  }

  /** Queue a command for the next step. */
  push(cmd) {
    const t = this.S.tick
    if (t < this.maxTick) this.truncate(t)
    if (!this.cmds.has(t)) this.cmds.set(t, [])
    this.cmds.get(t).push(cmd)
  }

  hasPending() {
    return this.cmds.has(this.S.tick)
  }

  truncate(t) {
    for (const k of [...this.cmds.keys()]) if (k >= t) this.cmds.delete(k)
    this.snaps = this.snaps.filter((s) => s.tick <= t)
    this.maxTick = t
  }

  /** Advance one tick; returns that tick's events. */
  step() {
    const S = this.S
    step(S, this.cmds.get(S.tick) || [])
    if (S.tick % SNAPSHOT_EVERY === 0 && S.tick > this.snaps[this.snaps.length - 1].tick) this.snaps.push(clone(S))
    if (S.tick > this.maxTick) this.maxTick = S.tick
    return S.events
  }

  /** Jump to any tick in [0, maxTick]. */
  seek(tick) {
    const target = Math.max(0, Math.min(tick, this.maxTick))
    let snap = this.snaps[0]
    for (const s of this.snaps) if (s.tick <= target) snap = s
    this.S = clone(snap)
    while (this.S.tick < target) step(this.S, this.cmds.get(this.S.tick) || [])
    this.S.events = []
    return this.S
  }

  /** Everything needed to reproduce this run elsewhere. */
  serialize() {
    return { scenario: this.scenarioId, ...this.opts, cmds: [...this.cmds.entries()] }
  }

  static from(data) {
    const tl = new Timeline(data.scenario, { seed: data.seed, brief: data.brief, plan: data.plan ?? null })
    tl.cmds = new Map(data.cmds)
    return tl
  }
}
