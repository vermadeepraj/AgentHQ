// Main-thread client for the Claude proxy (/api/agent). Everything the AI decides is
// turned into ordinary sim inputs — the plan goes into `init`, replies and actions
// become recorded commands — so runs stay deterministic and replayable.

import { clock as C } from '../sim/index.js'
import { statusOf } from '../ui/dom.js'
import { offlineReply } from './offline.js'

const ENDPOINT = '/api/agent'

async function post(body, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data.result
  } finally {
    clearTimeout(timer)
  }
}

export class AgentAI {
  constructor() {
    this.live = false
    this.models = null
    this.lastError = null
    this.ready = fetch(ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        this.live = !!d?.live
        this.models = d?.models || null
      })
      .catch(() => (this.live = false))
  }

  /** AI product manager: brief → plan, or null (free play then uses templates). */
  async plan(brief) {
    await this.ready
    if (!this.live || !brief) return null
    try {
      return await post({ task: 'plan', brief }, 45000)
    } catch (e) {
      this.lastError = e.message
      return null
    }
  }

  /** CEO → agent conversation. Falls back to the offline brain on any failure. */
  async chat(S, agentId, message) {
    const a = S.agents.find((x) => x.id === agentId)
    if (!a) return null
    await this.ready
    if (this.live) {
      try {
        const r = await post(this.chatContext(S, a, message), 20000)
        const action = this.checkAction(S, a, r.action)
        // The model promised a ticket the agent can't take: say so rather than silently doing nothing.
        const reply = r.action?.type === 'assign' && action.type === 'none' ? `Hmm — I can't take ${r.action.ticket || 'that'} right now. Anything else?` : r.reply
        return { reply, thought: r.thought, action, source: 'claude' }
      } catch (e) {
        this.lastError = e.message
      }
    }
    return { ...offlineReply(S, a, message), source: 'offline' }
  }

  /** Only let through an assign the agent can actually take (the model can misread the board). */
  checkAction(S, a, action) {
    if (action?.type !== 'assign') return action || { type: 'none' }
    const id = String(action.ticket || '').replace(/^#?/, '#')
    const t = S.tickets.find((x) => x.id === id)
    return t && ['todo', 'doing'].includes(t.status) && (a.skills[t.type] || 0) > 0 ? { type: 'assign', ticket: id } : { type: 'none' }
  }

  chatContext(S, a, message) {
    const names = Object.fromEntries(S.agents.map((x) => [x.id, x.first]))
    const done = new Set(S.tickets.filter((t) => t.status === 'done').map((t) => t.id))
    return {
      task: 'chat',
      message,
      clock: C.fmtClock(S.clock),
      project: `${S.scenario.client} — ${S.scenario.brief}`,
      agent: {
        name: a.name, role: a.role, trait: a.trait, skills: a.skills, energy: a.energy, morale: a.morale,
        status: statusOf(a), thought: a.thought, memory: a.memory.map((m) => `${C.fmtTime(m.clock)} ${m.text}`),
      },
      tickets: S.tickets.map((t) => ({
        id: t.id, title: t.title, type: t.type, status: t.status, assignee: names[t.assignee] || null,
        blocked: t.status === 'todo' && t.deps.some((d) => !done.has(d)),
      })),
    }
  }
}

/**
 * Turn a chat result into sim commands (recorded by the Timeline like any other).
 * The action goes first so the agent's own reply, not the action's stock line, is what they say.
 */
export function chatCommands(agentId, message, r) {
  const cmds = []
  const t = r.action?.type
  if (t === 'assign' && r.action.ticket) cmds.push({ type: 'assign', agent: agentId, ticket: r.action.ticket.startsWith('#') ? r.action.ticket : `#${r.action.ticket}` })
  else if (t === 'break' || t === 'sendHome') cmds.push({ type: t, agent: agentId })
  cmds.push({ type: 'voice', agent: agentId, heard: message, say: r.reply, thought: r.thought })
  return cmds
}
