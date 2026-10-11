// Output channels of the simulation:
//  - events: per-tick machine-readable signals (render FX, sounds)
//  - feed:   human-readable history shown in the UI
//  - say:    speech bubbles; memory: per-agent recollections for the inspector

const FEED_LIMIT = 80
const MEMORY_LIMIT = 8

export function emit(S, type, data = {}) {
  S.events.push({ type, tick: S.tick, ...data })
}

export function log(S, text, kind = 'info', who = null) {
  S.feed.push({ id: S.seq++, clock: S.clock, text, kind, who })
  if (S.feed.length > FEED_LIMIT) S.feed.shift()
}

export function say(S, agent, text) {
  agent.say = text
  agent.sayId = S.seq++
}

export function remember(S, agent, text) {
  agent.memory.push({ clock: S.clock, text })
  if (agent.memory.length > MEMORY_LIMIT) agent.memory.shift()
}
