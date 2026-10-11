// First-run coach: one short tip at a time, triggered by what's happening in the
// office. Seen tips are remembered per browser; "Skip tips" turns them all off.

import { clock as C } from '../sim/index.js'
import { el } from './dom.js'

const STORE_KEY = 'agenthq.tips'

// Order matters: the first unseen tip whose condition holds is shown.
const TIPS = [
  {
    id: 'welcome',
    when: () => true,
    title: 'Welcome, CEO',
    text: 'Your team runs on its own — right now they’re heading to the kickoff. <b>Click anyone</b> to read their mind.',
    doneWhen: (S, app) => !!app.selected,
  },
  {
    id: 'mind',
    when: (S, app) => !!app.selected,
    title: 'Reading a mind',
    text: 'Every choice is scored — the top bar wins. Needs (energy, morale, focus) shift those scores all day.',
  },
  {
    id: 'board',
    when: (S) => S.tickets.length > 0,
    title: 'The sprint board',
    text: 'The PM turned the brief into tickets. <b>Click a card</b> to hand it to someone — or let the team pick.',
    target: '.kanban:not(.closed)',
  },
  {
    id: 'speed',
    when: (S) => C.minuteOfDay(S.clock) > 11 * 60 || C.dayOf(S.clock) > 1,
    title: 'Time',
    text: 'Press <b>2–4</b> to speed up, <b>Space</b> to pause. A workday is about 7 minutes at 1×.',
    target: '.speeds',
  },
  {
    id: 'rewind',
    when: (S) => S.stats?.bugs > 0 || C.minuteOfDay(S.clock) > 14 * 60 || C.dayOf(S.clock) > 1,
    title: 'Rewind',
    text: 'Made a bad call? <b>Drag the timeline</b> back. Your next command starts a new future from there.',
    target: '.scrub',
  },
  {
    id: 'levers',
    when: (S) => avg(S, 'energy') < 0.5 || C.minuteOfDay(S.clock) > 15 * 60 || C.dayOf(S.clock) > 1,
    title: 'Your levers',
    text: 'Energy dipping? <b>🍕 Pizza.</b> A queue backing up? <b>➕ Hire.</b> Deadline close? <b>🔥 Crunch</b> — at a cost to morale.',
    target: '.actions-bar',
  },
]

const avg = (S, k) => S.agents.reduce((s, a) => s + a[k], 0) / Math.max(1, S.agents.length)

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || { seen: [], off: false }
  } catch {
    return { seen: [], off: false }
  }
}

export function resetTips() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {}
}

export class Coach {
  constructor(root, app) {
    this.app = app
    this.store = load()
    this.current = null
    this.shownAt = 0
    this.node = el('div', { class: 'coach panel', role: 'status', hidden: '' })
    root.appendChild(this.node)
    this.node.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act
      if (act === 'next') this.dismiss()
      if (act === 'skip') {
        this.store.off = true
        this.save()
        this.hide()
      }
    })
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.store))
    } catch {}
  }

  dismiss() {
    if (!this.current) return
    this.store.seen.push(this.current.id)
    this.save()
    this.hide()
  }

  hide() {
    this.current = null
    this.node.hidden = true
    document.querySelector('.coach-target')?.classList.remove('coach-target')
  }

  update(S, now) {
    if (this.store.off || this.app.ui.modal) return this.current && this.hide()
    const tip = this.current
    if (tip) {
      if (tip.doneWhen?.(S, this.app) && now - this.shownAt > 800) this.dismiss()
      else this.highlight(tip)
      return
    }
    const next = TIPS.find((t) => !this.store.seen.includes(t.id) && t.when(S, this.app))
    if (!next) return
    this.current = next
    this.shownAt = now
    const left = TIPS.filter((t) => !this.store.seen.includes(t.id)).length
    this.node.innerHTML = `
      <p class="eyebrow mono">Tip · ${TIPS.length - left + 1}/${TIPS.length}</p>
      <h3>${next.title}</h3>
      <p>${next.text}</p>
      <div class="coach-buttons"><button data-act="skip">Skip tips</button><button data-act="next" class="primary">Got it</button></div>`
    this.node.hidden = false
    this.highlight(next)
  }

  highlight(tip) {
    const prev = document.querySelector('.coach-target')
    const target = tip.target ? document.querySelector(tip.target) : null
    if (prev && prev !== target) prev.classList.remove('coach-target')
    target?.classList.add('coach-target')
  }
}
