// Meetings and gatherings: kickoff, standup, all-hands, fire drill, celebration.
// One at a time; starting a new one ends the current one (effects still apply).

import { spots, GATHER } from '../world/layout.js'
import { snapWalkable } from '../world/nav.js'
import { emit, log, say } from '../events.js'
import { setPlan } from '../agents/plans.js'
import { revealTickets } from './tickets.js'

const KINDS = {
  kickoff: { dur: 30, walk: 8, label: 'Kickoff meeting', act: 'sit' },
  standup: { dur: 12, walk: 6, label: 'Daily standup', act: 'stand' },
  allhands: { dur: 15, walk: 7, label: 'All-hands', act: 'stand' },
  drill: { dur: 15, walk: 6, label: 'Fire drill', act: 'stand' },
  celebrate: { dur: 14, walk: 6, label: 'Launch party', act: 'celebrate' },
}

function gatherSpots(kind, n) {
  const g = GATHER[kind]
  const out = []
  for (let k = 0; k < n; k++) {
    if (g.kind === 'circle') {
      const ang = (k / n) * Math.PI * 2
      const p = snapWalkable(g.x + Math.sin(ang) * g.r, g.z + Math.cos(ang) * g.r)
      out.push({ ...p, yaw: Math.atan2(g.x - p.x, g.z - p.z) })
    } else {
      const row = Math.floor(k / g.perRow)
      const col = k % g.perRow
      const p = snapWalkable(g.x + col * g.dx + (row % 2) * g.dx * 0.5, g.z + row * g.dz)
      out.push({ ...p, yaw: g.yaw })
    }
  }
  return out
}

const canAttend = (a) => a.present && !a.hidden && a.plan[0]?.k !== 'leave' && a.plan[1]?.k !== 'leave'

export function startMeeting(S, kind, ids, opts = {}) {
  if (S.meeting) endMeeting(S)
  const def = KINDS[kind]
  const attendees = S.agents.filter((a) => ids.includes(a.id) && canAttend(a))
  if (!attendees.length) return null
  const m = {
    id: S.seq++, kind, label: opts.label || def.label, start: S.clock,
    until: S.clock + def.walk + def.dur, attendees: attendees.map((a) => a.id),
    presenter: null, lines: opts.lines || [],
  }
  S.meeting = m
  S.stats.meetings++

  if (kind === 'kickoff') {
    const presenter = attendees.find((a) => a.id === opts.presenter) || attendees[0]
    m.presenter = presenter.id
    const w = spots.whiteboard
    setPlan(S, presenter, [{ k: 'goto', x: w.x, z: w.z, yaw: w.yaw }, { k: 'meet', id: m.id, act: 'present', yaw: w.yaw }])
    attendees.filter((a) => a !== presenter).forEach((a, i) => {
      const s = spots[`meet:${i % 7}`]
      setPlan(S, a, [{ k: 'goto', x: s.x, z: s.z, yaw: s.yaw }, { k: 'meet', id: m.id, act: 'sit', yaw: s.yaw }])
    })
  } else {
    const places = gatherSpots(kind, attendees.length)
    attendees.forEach((a, i) => {
      const p = places[i]
      setPlan(S, a, [{ k: 'goto', x: p.x, z: p.z, yaw: p.yaw }, { k: 'meet', id: m.id, act: def.act, yaw: p.yaw }])
    })
  }
  for (const a of attendees) a.focus = Math.max(0.25, a.focus * 0.6)
  emit(S, 'meetingStart', { kind, id: m.id })
  log(S, `${m.label} started`, kind === 'drill' ? 'bad' : 'info')
  return m
}

/** Called every tick while a meeting runs. */
export function updateMeeting(S) {
  const m = S.meeting
  if (m.kind === 'kickoff' && m.lines.length) {
    const def = KINDS.kickoff
    const t = (S.clock - m.start - def.walk) / def.dur
    const n = Math.max(0, Math.min(m.lines.length, Math.floor(t * (m.lines.length + 1))))
    if (n > S.whiteboard.length) S.whiteboard = m.lines.slice(0, n)
  }
  if (S.clock >= m.until) endMeeting(S)
}

export function endMeeting(S) {
  const m = S.meeting
  if (!m) return
  S.meeting = null
  for (const id of m.attendees) {
    const a = S.agents.find((x) => x.id === id)
    if (a && a.plan.some((st) => st.k === 'meet' && st.id === m.id)) setPlan(S, a, [])
  }
  const people = m.attendees.map((id) => S.agents.find((x) => x.id === id)).filter(Boolean)
  if (m.kind === 'kickoff') {
    S.whiteboard = m.lines.slice()
    revealTickets(S)
    S.phase = 'build'
  } else if (m.kind === 'standup') {
    for (const a of people) a.morale = Math.min(1, a.morale + 0.02)
  } else if (m.kind === 'allhands') {
    for (const a of people) {
      a.morale = Math.min(1, a.morale + 0.06)
      say(S, a, 'Feeling the vision ✨')
    }
  } else if (m.kind === 'celebrate') {
    S.hooks.push({ type: 'finish' })
  }
  emit(S, 'meetingEnd', { kind: m.kind, id: m.id })
}
