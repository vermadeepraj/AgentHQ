// Right panel: the team list, or one agent's mind — what they're doing,
// how they feel, and the utility scores behind their last decision — plus a box
// to talk to them (answered by Claude when live AI is on, else the offline brain).

import { clock as C, TEAMS } from '../sim/index.js'
import { el, patch, esc, avatar, pct, statusOf, teamColor } from './dom.js'

export class Inspector {
  constructor(root, app) {
    this.app = app
    this.node = el('aside', { class: 'inspector panel', 'aria-label': 'Team' })
    this.toggle = el('button', { class: 'team-toggle panel', title: 'Team' }, '👥 Team')
    this.body = el('div', { class: 'insp-body' })
    this.chat = el('form', { class: 'chat', hidden: '' }, `
      <p class="chat-reply" hidden></p>
      <div class="chat-row"><input name="msg" maxlength="200" autocomplete="off" aria-label="Message" /><button aria-label="Send">➤</button></div>
      <p class="chat-status mono"></p>`)
    this.node.append(this.body, this.chat)
    root.append(this.node, this.toggle)
    this.chatFor = null
    this.chat.addEventListener('submit', (e) => this.send(e))
    this.open = false
    this.toggle.addEventListener('click', () => this.setOpen(!this.open))
    this.node.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]')
      if (!b) return
      const id = this.app.selected
      const act = b.dataset.act
      if (act === 'pick') this.app.select(b.dataset.id)
      else if (act === 'back') this.app.select(null)
      else if (act === 'follow') this.app.select(id, { follow: !this.app.following })
      else if (act === 'assign') this.app.ui.ticketMenu(id, b)
      else this.app.command({ type: act, agent: id })
    })
  }

  /** Small screens only: the team list is a sheet you open on demand. */
  setOpen(v) {
    this.open = v
    this.node.classList.toggle('open', v)
    this.toggle.classList.toggle('active', v)
    if (v && innerWidth <= 900) this.app.ui.parts?.kanban.setOpen(false)
  }

  async send(e) {
    e.preventDefault()
    const input = this.chat.elements.msg
    const message = input.value.trim()
    const id = this.app.selected
    if (!message || !id || input.disabled) return
    const a = this.app.state.agents.find((x) => x.id === id)
    input.disabled = true
    this.setChat(null, `${a.first} is typing…`)
    const r = await this.app.askAgent(id, message)
    input.disabled = false
    if (this.chatFor !== id) return
    input.value = ''
    input.focus()
    this.setChat(r?.reply, r?.source === 'claude' ? '✦ answered by Claude' : 'offline brain · add an API key for Claude')
  }

  setChat(reply, status) {
    const p = this.chat.querySelector('.chat-reply')
    p.hidden = !reply
    p.textContent = reply ? `“${reply}”` : ''
    this.chat.querySelector('.chat-status').textContent = status || ''
  }

  update(S) {
    const a = this.app.selected && S.agents.find((x) => x.id === this.app.selected)
    this.node.classList.toggle('has-agent', !!a)
    patch(this.body, a ? this.agentHtml(S, a) : this.teamHtml(S))
    this.chat.hidden = !a || !a.present
    if (a && this.chatFor !== a.id) {
      this.chatFor = a.id
      this.chat.elements.msg.placeholder = `Talk to ${a.first}… e.g. “take a break” or “work on #105”`
      this.chat.elements.msg.value = ''
      this.setChat(null, '')
    }
  }

  teamHtml(S) {
    const rows = S.agents
      .map((a) => {
        const t = a.ticket && S.tickets.find((x) => x.id === a.ticket)
        return `<button class="member ${a.present && !a.hidden ? '' : 'away'}" data-act="pick" data-id="${a.id}">
          ${avatar(a)}
          <span class="member-text"><b>${esc(a.first)}</b><small>${esc(a.role)}</small></span>
          <span class="member-status">${t ? esc(t.title) : esc(statusOf(a))}</span>
          <span class="energy" title="Energy ${pct(a.energy)}"><i style="height:${pct(a.energy)}"></i></span>
        </button>`
      })
      .join('')
    return `<h2>Team <span class="muted">${S.agents.filter((a) => a.present).length}/${S.agents.length} in</span></h2><div class="members">${rows}</div>
      <p class="hint">Click someone — in the list or in the office — to see what they're thinking.</p>`
  }

  agentHtml(S, a) {
    const t = a.ticket && S.tickets.find((x) => x.id === a.ticket)
    const mine = S.tickets.find((x) => x.assignee === a.id && x.status === 'doing')
    const bar = (label, v, c) => `<div class="need"><span>${label}</span><span class="meter"><i style="width:${pct(v)};--c:${c}"></i></span><b class="mono">${pct(v)}</b></div>`
    const max = Math.max(...a.why.map((w) => w.score), 0.01)
    const why = a.why
      .map((w, i) => `<li class="${i === 0 ? 'top' : ''}"><span>${esc(w.label)}</span><span class="score"><i style="width:${pct(Math.min(1, w.score / max))}"></i><b class="mono">${w.score.toFixed(2)}</b></span></li>`)
      .join('')
    const skills = Object.entries(a.skills)
      .filter(([, v]) => v >= 0.3)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `<span class="skill">${k} <b>${Math.round(v * 100)}</b></span>`)
      .join('')
    const memory = a.memory.slice().reverse().map((m) => `<li><span class="mono">${C.fmtTime(m.clock)}</span>${esc(m.text)}</li>`).join('')
    const work = t || mine
    return `
      <button class="back" data-act="back">← Team</button>
      <div class="who">
        ${avatar(a, 52)}
        <div><h2>${esc(a.name)}</h2><p>${esc(a.role)} · <span style="color:${teamColor(a.team)}">${TEAMS[a.team].label}</span>${a.contractor ? ' · <span class="chip">Contractor</span>' : ''}</p></div>
      </div>
      <p class="status"><span class="dot ${a.present && !a.hidden ? 'on' : ''}"></span>${esc(statusOf(a))}</p>
      <blockquote>“${esc(a.thought)}”</blockquote>
      <div class="needs">
        ${bar('Energy', a.energy, a.energy > 0.4 ? 'var(--good)' : a.energy > 0.2 ? 'var(--warn)' : 'var(--bad)')}
        ${bar('Morale', a.morale, a.morale > 0.55 ? 'var(--good)' : a.morale > 0.35 ? 'var(--warn)' : 'var(--bad)')}
        ${bar('Focus', a.focus, 'var(--accent)')}
      </div>
      <h3>Why this? <span class="muted">utility scores</span></h3>
      <ol class="why">${why || '<li class="muted">Off duty</li>'}</ol>
      ${work ? `<h3>Working on</h3><div class="ticket"><b>${esc(work.title)}</b><span class="mono muted">${work.id} · ${work.status}</span><span class="bar"><i style="width:${pct(Math.min(1, work.progress / work.effort))}"></i></span></div>` : ''}
      <div class="actions">
        <button data-act="follow" class="${this.app.following ? 'active' : ''}">🎥 ${this.app.following ? 'Following' : 'Follow'}</button>
        <button data-act="assign">📋 Assign</button>
        ${a.present ? '<button data-act="break">☕ Break</button><button data-act="sendHome">🏠 Send home</button>' : '<button data-act="page">📟 Page in</button>'}
      </div>
      <h3>Skills</h3><div class="skills">${skills}</div>
      <p class="trait">${esc(a.trait)}</p>
      <h3>Memory</h3><ul class="memory">${memory || '<li class="muted">Nothing yet</li>'}</ul>
      <p class="stats-line mono">✓ ${a.stats.done} shipped · 👀 ${a.stats.reviews} reviews · ☕ ${a.stats.coffees} · 🐞 ${a.stats.reworks}</p>`
  }
}
