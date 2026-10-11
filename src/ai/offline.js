// Offline conversation brain: answers the CEO from the agent's current state with
// simple intent rules, so "talk to an agent" works without an API key. Same result
// shape as the live Claude reply: { reply, thought, action }.

import { statusOf } from '../ui/dom.js'

const pick = (list, seed) => list[Math.abs(seed) % list.length]
const hashOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

export function offlineReply(S, a, message) {
  const m = message.toLowerCase()
  const seed = hashOf(message + S.tick)
  const mine = S.tickets.find((t) => t.assignee === a.id && t.status === 'doing')
  const open = S.tickets.filter((t) => ['todo', 'doing'].includes(t.status) && (a.skills[t.type] || 0) > 0)

  const idMatch = m.match(/#?\b(\d{3})\b/)
  const byId = idMatch && open.find((t) => t.id === `#${idMatch[1]}`)
  const byTitle = !byId && /\b(work on|do|take|pick up|start|handle|build|fix)\b/.test(m)
    ? open.find((t) => t.title.toLowerCase().split(/\W+/).some((w) => w.length > 3 && m.includes(w)))
    : null
  const ticket = byId || byTitle
  if (ticket) {
    if (ticket.assignee === a.id) return { reply: `Already on ${ticket.id} — ${Math.round((ticket.progress / ticket.effort) * 100)}% there.`, thought: 'The CEO is checking on me', action: { type: 'none' } }
    return { reply: pick([`Sure — switching to ${ticket.title}.`, `On it: ${ticket.id} ${ticket.title}.`, `Got it, ${ticket.title} it is.`], seed), thought: `CEO wants ${ticket.id} done`, action: { type: 'assign', ticket: ticket.id } }
  }
  if (/\b(break|rest|coffee|tea|relax|breather)\b/.test(m)) {
    return { reply: a.energy < 0.5 ? 'Honestly? I needed that. Back in ten.' : pick(['A quick one, then back to it.', 'Coffee run — want anything?'], seed), thought: 'Break time', action: { type: 'break' } }
  }
  if (/\b(go home|head home|log off|sleep|call it a day|leave)\b/.test(m)) {
    return { reply: pick(['Thanks — see you tomorrow!', 'Heading out. Ping me if prod catches fire.'], seed), thought: 'Calling it a day', action: { type: 'sendHome' } }
  }
  if (/\b(how|status|update|progress|doing|going)\b/.test(m)) {
    const mood = a.energy < 0.3 ? 'running on fumes' : a.morale < 0.4 ? 'a bit flat, to be honest' : 'good'
    const work = mine ? `${mine.title} is ${Math.round((mine.progress / mine.effort) * 100)}% done` : `I'm ${statusOf(a).toLowerCase()}`
    return { reply: `Feeling ${mood}. ${work}.`, thought: a.thought, action: { type: 'none' } }
  }
  if (/\b(thanks|thank you|great job|good job|well done|nice work|awesome)\b/.test(m)) {
    return { reply: pick(['Appreciate it! 🙌', 'Thanks — team effort.', 'That made my day.'], seed), thought: 'The CEO noticed my work', action: { type: 'none' } }
  }
  return {
    reply: pick([`Mm-hm. Right now: ${a.thought.toLowerCase()}.`, `Noted! I'm on ${mine ? mine.title : 'it'}.`, 'Sure thing, boss.'], seed),
    thought: a.thought,
    action: { type: 'none' },
  }
}
