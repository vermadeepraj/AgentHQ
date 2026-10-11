// Event feed (bottom-left) and toasts for the moments that matter.

import { clock as C } from '../sim/index.js'
import { el, patch, esc } from './dom.js'

const TOASTS = {
  deployed: () => ({ text: '🚀 It’s live!', kind: 'good' }),
  qaReject: () => ({ text: '🐞 QA bounced a build', kind: 'bad' }),
  alarm: () => ({ text: '🚨 Production is down', kind: 'bad' }),
  resolved: () => ({ text: '✅ Service restored', kind: 'good' }),
  ticketsCreated: (e) => ({ text: `📋 ${e.count} tickets on the board`, kind: 'info' }),
  chaos: (e) => ({ text: { drill: '🔔 Fire drill!', coffee: '☕ Coffee machine broke', laptop: '💀 A laptop died', viral: '📈 You went viral' }[e.kind], kind: e.kind === 'viral' ? 'good' : 'bad' }),
}

export class Feed {
  constructor(root) {
    this.node = el('div', { class: 'feed', 'aria-live': 'polite' })
    this.toasts = el('div', { class: 'toasts' })
    root.append(this.node, this.toasts)
  }

  update(S) {
    const items = S.feed.slice(-5).reverse()
    patch(this.node, items.map((f, i) => `<p class="feed-item ${f.kind}" style="--i:${i}"><span class="mono">${C.fmtTime(f.clock)}</span>${esc(f.text)}</p>`).join(''))
  }

  event(e) {
    const make = TOASTS[e.type]
    if (!make) return
    const { text, kind } = make(e)
    if (!text) return
    const t = el('div', { class: `toast ${kind}` }, esc(text))
    this.toasts.appendChild(t)
    setTimeout(() => t.classList.add('out'), 2600)
    setTimeout(() => t.remove(), 3200)
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove()
  }
}
