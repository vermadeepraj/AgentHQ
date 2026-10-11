// UI orchestrator: owns the overlay components, modals, menus and shortcuts.

import { CONTRACTORS, MAX_HIRES } from '../sim/index.js'
import { Hud } from './Hud.js'
import { Kanban } from './Kanban.js'
import { Inspector } from './Inspector.js'
import { Dock } from './Dock.js'
import { Feed } from './Feed.js'
import { Tags } from './Tags.js'
import { Coach } from './Coach.js'
import { startScreen, decisionModal, outcomeModal, helpModal, popover } from './Modals.js'
import { el, esc, avatar, statusOf } from './dom.js'

const PANEL_HZ = 6

export class UI {
  constructor(app, { root, tags }) {
    this.app = app
    this.root = root
    this.tags = new Tags(tags, app)
    this.parts = null
    this.modal = null
    this.decisionShown = null
    this.outcomeShown = false
    this.scenario = null
    this.lastPanel = 0
    addEventListener('keydown', (e) => this.onKey(e))
  }

  // ── Screens ───────────────────────────────────────────────────────────
  showStart() {
    this.teardown()
    this.setModal(startScreen((id, brief) => (id === 'free' ? this.app.playFree(brief) : this.app.play(id)), this.app.ai))
  }

  startSession(scenario) {
    this.teardown()
    this.scenario = scenario
    this.decisionShown = null
    this.outcomeShown = false
    const help = el('button', { class: 'help-btn panel', title: 'How to play (H)' }, '?')
    help.addEventListener('click', () => this.showHelp())
    const sound = el('button', { class: 'sound-btn panel', title: 'Sound on/off (M)', 'aria-label': 'Toggle sound' })
    sound.addEventListener('click', () => this.toggleSound())
    this.root.append(help, sound)
    this.parts = {
      hud: new Hud(this.root, this.app),
      kanban: new Kanban(this.root, this.app),
      inspector: new Inspector(this.root, this.app),
      dock: new Dock(this.root, this.app),
      feed: new Feed(this.root),
      coach: new Coach(this.root, this.app),
      help,
      sound,
    }
    this.renderSoundBtn()
  }

  teardown() {
    this.setModal(null)
    this.tags.clear()
    this.root.innerHTML = ''
    this.parts = null
  }

  setModal(node) {
    this.modal?.remove()
    this.modal = node
    if (node) this.root.appendChild(node)
  }

  showHelp() {
    this.setModal(helpModal(() => this.setModal(null)))
  }

  toggleSound() {
    this.app.sound.setMuted(!this.app.sound.muted)
    this.renderSoundBtn()
  }

  renderSoundBtn() {
    const muted = this.app.sound.muted
    this.parts.sound.textContent = muted ? '🔇' : '🔊'
    this.parts.sound.classList.toggle('active', !muted)
  }

  confirmMenu() {
    if (confirm('Leave this project and go back to the scenario list?')) this.app.attract()
  }

  // ── Frame / event plumbing ────────────────────────────────────────────
  onFrame(frame) {
    const S = frame.state
    if (!this.parts) return
    if (S.decision && this.decisionShown !== S.decision.id) {
      this.decisionShown = S.decision.id
      this.setModal(decisionModal(S.decision, (option) => {
        this.app.command({ type: 'decide', id: S.decision.id, option })
        this.setModal(null)
      }))
    }
    if (S.outcome && !this.outcomeShown && frame.tick >= frame.maxTick) {
      this.outcomeShown = true
      setTimeout(() => this.showOutcome(), 2500)
    }
  }

  showOutcome() {
    const S = this.app.state
    if (!S?.outcome || !this.parts) return
    this.setModal(outcomeModal(S, {
      onReplay: () => {
        this.setModal(null)
        this.app.sim.seek(0)
        this.parts.dock.setSpeed(8)
      },
      onRetry: () => this.app.play(this.scenario, { brief: S.scenario.brief, plan: this.app.session?.plan }),
      onMenu: () => this.app.attract(),
      onClose: () => this.setModal(null),
    }))
  }

  onEvent(e) {
    this.parts?.feed.event(e)
  }

  onSelect(id) {
    this.lastPanel = 0
    if (id && innerWidth <= 900 && this.parts?.kanban.open) this.parts.kanban.setOpen(false)
  }

  update(dt, now) {
    const S = this.app.state
    if (!S || !this.parts) return
    this.tags.update(S, now)
    if (now - this.lastPanel < 1000 / PANEL_HZ) return
    this.lastPanel = now
    const p = this.parts
    p.hud.update(S)
    p.kanban.update(S)
    p.inspector.update(S)
    p.dock.update(this.app.frame)
    p.feed.update(S)
    p.coach.update(S, now)
  }

  // ── Menus ─────────────────────────────────────────────────────────────
  assignMenu(ticketId, anchor) {
    const S = this.app.state
    const t = S.tickets.find((x) => x.id === ticketId)
    if (!t || !['todo', 'doing'].includes(t.status)) return
    const people = S.agents.filter((a) => (a.skills[t.type] || 0) > 0).sort((a, b) => b.skills[t.type] - a.skills[t.type])
    popover(anchor, `Assign ${t.id} · ${t.title}`, people.map((a) => ({
      value: a.id,
      html: `${avatar(a, 26)}<span class="pm-text"><b>${esc(a.first)}</b><small>${esc(statusOf(a))}</small></span><span class="pm-skill mono">${Math.round(a.skills[t.type] * 100)}</span>`,
    })), (agent) => this.app.command({ type: 'assign', ticket: t.id, agent }))
  }

  ticketMenu(agentId, anchor) {
    const S = this.app.state
    const a = S.agents.find((x) => x.id === agentId)
    const list = S.tickets.filter((t) => ['todo', 'doing'].includes(t.status) && (a.skills[t.type] || 0) > 0)
    list.sort((x, y) => (a.skills[y.type] || 0) - (a.skills[x.type] || 0) || y.pri - x.pri)
    popover(anchor, `Give ${a.first} a ticket`, list.map((t) => ({
      value: t.id,
      html: `<span class="pm-text"><b>${esc(t.title)}</b><small>${t.id} · ${t.type} · ${t.status}${t.assignee ? ` · ${esc(S.agents.find((x) => x.id === t.assignee)?.first || '')}` : ''}</small></span><span class="pm-skill mono">${Math.round((a.skills[t.type] || 0) * 100)}</span>`,
    })), (ticket) => this.app.command({ type: 'assign', ticket, agent: agentId }))
  }

  hireMenu(anchor) {
    const S = this.app.state
    const left = MAX_HIRES - S.hires
    popover(anchor, `Hire a contractor · ${left} left`, Object.entries(CONTRACTORS).map(([role, c]) => ({
      value: role,
      disabled: left <= 0,
      html: `<span class="pm-text"><b>${esc(c.role)}</b><small>skill ${Math.round(Math.max(...Object.values(c.skills)) * 100)} · $110/h</small></span>`,
    })), (role) => this.app.command({ type: 'hire', role }))
  }

  // ── Keyboard ──────────────────────────────────────────────────────────
  onKey(e) {
    if (e.target.closest?.('input, textarea') || !this.parts) return
    const k = e.key.toLowerCase()
    const dock = this.parts.dock
    if (k === ' ') {
      e.preventDefault()
      dock.setSpeed(0)
    } else if (['1', '2', '3', '4'].includes(k)) dock.setSpeed([1, 2, 4, 8][Number(k) - 1])
    else if (k === 'k') this.parts.kanban.setOpen(!this.parts.kanban.open)
    else if (k === 'f' && this.app.selected) this.app.select(this.app.selected, { follow: !this.app.following })
    else if (k === 'h' || k === '?') this.showHelp()
    else if (k === 'm') this.toggleSound()
    else if (k === 'escape') {
      if (this.modal && !this.modal.classList.contains('decision')) this.setModal(null)
      else this.app.select(null)
      document.querySelector('.popover')?.remove()
    }
  }
}
