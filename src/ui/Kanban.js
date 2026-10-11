// Left drawer: the sprint board. Click a card to (re)assign it.

import { el, patch, esc, avatar, pct } from './dom.js'
import { TYPE_COLORS } from '../render/office/boards.js'

const SECTIONS = [['doing', 'In progress'], ['review', 'Code review'], ['qa', 'QA'], ['todo', 'To do'], ['done', 'Done']]

export class Kanban {
  constructor(root, app) {
    this.app = app
    this.open = innerWidth > 1100
    this.node = el('aside', { class: 'kanban panel', 'aria-label': 'Sprint board' })
    this.toggle = el('button', { class: 'kanban-toggle panel', title: 'Sprint board (K)' }, '▤ Board')
    root.append(this.node, this.toggle)
    this.toggle.addEventListener('click', () => this.setOpen(!this.open))
    this.node.addEventListener('click', (e) => {
      const card = e.target.closest('[data-ticket]')
      if (card) this.app.ui.assignMenu(card.dataset.ticket, card)
    })
    this.setOpen(this.open)
  }

  setOpen(v) {
    this.open = v
    this.node.classList.toggle('closed', !v)
    this.toggle.classList.toggle('active', v)
    if (v && innerWidth <= 900) {
      this.app.ui.parts?.inspector.setOpen(false)
      this.app.select(null)
    }
  }

  update(S) {
    if (!this.open) return
    const agents = Object.fromEntries(S.agents.map((a) => [a.id, a]))
    if (!S.tickets.length) {
      patch(this.node, `<h2>Sprint board</h2><p class="empty">Tickets appear after the kickoff meeting.</p>`)
      return
    }
    const cols = SECTIONS.map(([status, title]) => {
      const cards = S.tickets.filter((t) => t.status === status)
      const html = cards
        .map((t) => {
          const who = agents[t.assignee]
          const busy = t.reviewer || t.tester
          const blocked = status === 'todo' && t.deps.some((d) => S.tickets.find((x) => x.id === d)?.status !== 'done')
          return `<button class="card ${blocked ? 'blocked' : ''}" data-ticket="${t.id}" style="--c:${TYPE_COLORS[t.type]}" title="${esc(t.title)} — click to assign">
            <span class="card-title">${t.launch ? '🚀 ' : ''}${esc(t.title)}</span>
            <span class="card-meta mono">${t.id} · ${t.type}${t.reworks ? ` · 🐞${t.reworks}` : ''}${blocked ? ' · blocked' : ''}${busy ? ` · ${status === 'qa' ? 'testing' : 'reviewing'}` : ''}</span>
            ${status === 'doing' ? `<span class="bar"><i style="width:${pct(Math.min(1, t.progress / t.effort))}"></i></span>` : ''}
            ${who ? avatar(who, 22) : ''}
          </button>`
        })
        .join('')
      return cards.length ? `<section class="col col-${status}"><h3>${title}<span>${cards.length}</span></h3><div class="cards">${html}</div></section>` : ''
    })
    patch(this.node, `<h2>Sprint board</h2><div class="cols">${cols.join('')}</div>`)
  }
}
