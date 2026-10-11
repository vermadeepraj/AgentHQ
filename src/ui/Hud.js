// Top bar: project, clock + deadline, budget, morale, progress.

import { clock as C } from '../sim/index.js'
import { el, patch, esc, money } from './dom.js'

export class Hud {
  constructor(root, app) {
    this.app = app
    this.node = el('header', { class: 'hud panel' })
    root.appendChild(this.node)
    this.node.innerHTML = `
      <button class="brand" data-act="menu" title="Back to scenarios">Agent<b>HQ</b></button>
      <div class="hud-project"></div>
      <div class="hud-clock"></div>
      <div class="hud-stats"></div>`
    this.project = this.node.querySelector('.hud-project')
    this.clock = this.node.querySelector('.hud-clock')
    this.stats = this.node.querySelector('.hud-stats')
    this.node.querySelector('[data-act=menu]').addEventListener('click', () => app.ui.confirmMenu())
  }

  update(S) {
    patch(this.project, `<span class="chip">${esc(S.scenario.title)}</span><span class="hud-client">${esc(S.scenario.client)}</span>`)
    const left = S.scenario.deadline - S.clock
    const urgent = left < 180 && !S.launchedAt
    const status = S.outcome ? (S.outcome.result === 'win' ? 'Shipped ✓' : 'Missed ✕') : S.launchedAt ? 'Live 🚀' : `${C.fmtDuration(left)} left`
    const night = (S.clock % 1440) < 7 * 60 || (S.clock % 1440) > 19 * 60
    patch(this.clock, `
      <span class="hud-time mono">${night ? '🌙' : '☀️'} ${C.fmtClock(S.clock)}</span>
      <span class="pill ${urgent ? 'pill-bad' : ''}">${status}</span>
      ${S.crunch ? '<span class="pill pill-warn">🔥 Crunch</span>' : ''}
      ${S.outage?.active ? `<span class="pill pill-bad pulse">🚨 Down ${C.fmtDuration(S.clock - S.outage.since)}</span>` : ''}`)
    const morale = S.agents.reduce((s, a) => s + a.morale, 0) / S.agents.length
    const done = S.tickets.filter((t) => t.status === 'done').length
    const budgetPct = Math.max(0, S.budget / S.budget0)
    patch(this.stats, `
      <div class="stat" title="Budget left (payroll ${money(S.spent)}${S.loss ? `, lost revenue ${money(S.loss)}` : ''})">
        <span class="stat-label">Budget</span><span class="stat-value mono ${budgetPct < 0.2 ? 'bad' : ''}">${money(S.budget)}</span>
      </div>
      <div class="stat" title="Average team morale">
        <span class="stat-label">Morale</span>
        <span class="meter"><i style="width:${Math.round(morale * 100)}%;--c:${morale > 0.6 ? 'var(--good)' : morale > 0.4 ? 'var(--warn)' : 'var(--bad)'}"></i></span>
      </div>
      <div class="stat" title="Tickets done">
        <span class="stat-label">Shipped</span><span class="stat-value mono">${done}<small>/${S.tickets.length || '–'}</small></span>
      </div>`)
  }
}
