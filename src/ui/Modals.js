// Full-screen moments: start screen, CEO decisions, final grade, help.
// Plus small anchored popover menus.

import { SCENARIO_LIST, clock as C } from '../sim/index.js'
import { el, esc, money } from './dom.js'
import { resetTips } from './Coach.js'

export function startScreen(onPick, ai) {
  const cards = SCENARIO_LIST.map(
    (s) => `<button class="scenario" data-id="${s.id}">
      <span class="diff diff-${s.difficulty.toLowerCase()}">${esc(s.difficulty)}</span>
      <h3>${esc(s.title)}</h3>
      <p class="client">${esc(s.client)}</p>
      <p>${esc(s.blurb)}</p>
      <span class="meta mono">${s.tickets.length} tickets · due ${C.fmtClock(s.deadline)}</span>
    </button>`,
  ).join('')
  const node = el('div', { class: 'modal start' }, `
    <div class="start-inner">
      <p class="eyebrow mono">A playable office of AI agents</p>
      <h1>Agent<b>HQ</b></h1>
      <p class="lede">Ten AI teammates. One brief. They plan, design, build, review, test and ship — and you're the CEO.</p>
      <p class="ai-status mono"><span class="dot"></span><span class="ai-label">Checking for live AI…</span></p>
      <div class="scenarios">${cards}
        <form class="scenario free">
          <span class="diff diff-custom">Free play</span>
          <h3>Your idea</h3>
          <p>Describe a product. Priya, the PM, turns it into a plan.</p>
          <input name="brief" maxlength="140" placeholder='e.g. An online store called "Mitti" for handmade pottery' aria-label="Describe what to build" />
          <button class="go">Start building →</button>
        </form>
      </div>
      <p class="controls mono">drag to orbit · right-drag / WASD to pan · scroll to zoom · click a person to read their mind</p>
    </div>`)
  node.addEventListener('click', (e) => {
    const card = e.target.closest('.scenario[data-id]')
    if (card) onPick(card.dataset.id)
  })
  const form = node.querySelector('form')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (form.classList.contains('busy')) return
    const brief = new FormData(form).get('brief').trim()
    if (ai?.live) {
      form.classList.add('busy')
      form.querySelector('.go').textContent = 'Priya is planning…'
    }
    onPick('free', brief || 'A landing page and booking app for a neighbourhood yoga studio called "Prana"')
  })
  ai?.ready.then(() => {
    node.querySelector('.ai-status').classList.toggle('on', ai.live)
    node.querySelector('.ai-label').textContent = ai.live
      ? `Live AI on — Claude writes the plan and answers when you talk to the team`
      : 'Offline brains — add ANTHROPIC_API_KEY to .env.local for live Claude agents'
  })
  return node
}

export function decisionModal(decision, onChoose) {
  const node = el('div', { class: 'modal decision' }, `
    <div class="dialog panel" role="dialog" aria-modal="true" aria-labelledby="d-title">
      <p class="eyebrow mono">📞 Decision required — the office is paused</p>
      <h2 id="d-title">${esc(decision.title)}</h2>
      <p>${esc(decision.text)}</p>
      <div class="options">${decision.options.map((o) => `<button data-id="${o.id}"><b>${esc(o.label)}</b><span>${esc(o.hint)}</span></button>`).join('')}</div>
    </div>`)
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]')
    if (b) onChoose(b.dataset.id)
  })
  setTimeout(() => node.querySelector('button')?.focus(), 50)
  return node
}

export function outcomeModal(S, { onReplay, onRetry, onMenu, onClose }) {
  const o = S.outcome
  const bars = o.breakdown
    .map((b) => `<div class="bd"><span>${esc(b.label)}</span><span class="meter"><i style="width:${b.max ? Math.max(0, (b.value / b.max) * 100) : 100}%;--c:${b.value < 0 ? 'var(--bad)' : 'var(--accent)'}"></i></span><b class="mono">${b.value > 0 ? '+' : ''}${b.value}</b></div>`)
    .join('')
  const st = o.stats
  const node = el('div', { class: `modal outcome ${o.result}` }, `
    <div class="dialog panel" role="dialog" aria-modal="true">
      <button class="close" data-act="close" aria-label="Keep watching">✕</button>
      <p class="eyebrow mono">${o.result === 'win' ? 'Project shipped' : 'Project failed'} · ${C.fmtClock(o.clock)}</p>
      <div class="grade-row"><span class="grade grade-${o.grade}">${o.grade}</span><div><h2>${esc(S.scenario.client)}</h2><p>${esc(o.summary)}</p></div><span class="score mono">${o.score}<small>/100</small></span></div>
      <div class="breakdown">${bars}</div>
      <div class="facts mono">
        <span><b>${st.ticketsDone}/${st.tickets}</b> tickets</span><span><b>${st.bugs}</b> bugs caught</span>
        <span><b>${st.reviews}</b> reviews</span><span><b>${st.coffees}</b> coffees</span>
        <span><b>${money(st.spent)}</b> payroll</span>${st.loss ? `<span><b>${money(st.loss)}</b> lost revenue</span>` : `<span><b>${st.quality}%</b> quality</span>`}
      </div>
      <div class="buttons">
        <button data-act="replay">⏮ Watch the replay</button>
        <button data-act="retry" class="primary">Play again</button>
        <button data-act="menu">All scenarios</button>
      </div>
    </div>`)
  node.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'replay') onReplay()
    if (act === 'retry') onRetry()
    if (act === 'menu') onMenu()
    if (act === 'close') onClose()
  })
  return node
}

export function helpModal(onClose) {
  const keys = [
    ['Space', 'Pause / resume'], ['1 – 4', 'Speed 1× 2× 4× 8×'], ['K', 'Toggle sprint board'], ['F', 'Follow selected person'],
    ['Esc', 'Deselect / close'], ['W A S D', 'Pan the camera'], ['Drag', 'Orbit'], ['Right-drag', 'Pan'], ['Scroll', 'Zoom'],
    ['Double-click', 'Follow someone'], ['M', 'Sound on / off'], ['H', 'This help'],
  ]
  const node = el('div', { class: 'modal help' }, `
    <div class="dialog panel" role="dialog" aria-modal="true">
      <button class="close" aria-label="Close">✕</button>
      <h2>How to play</h2>
      <p>Your team works on its own. Your job is to keep them shipping: assign tickets, order pizza when energy dips, hire help when a queue backs up, and decide when it's worth crunching. Everyone's reasoning is visible — click a person to see the scores behind their choices.</p>
      <div class="keys">${keys.map(([k, v]) => `<span class="kbd mono">${k}</span><span>${v}</span>`).join('')}</div>
      <button class="reset-tips" data-act="tips">↺ Show the beginner tips again</button>
    </div>`)
  node.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=tips]')) {
      resetTips()
      e.target.textContent = 'Tips reset — they’ll show in your next project'
    }
    if (e.target === node || e.target.closest('.close')) onClose()
  })
  return node
}

/** Anchored list menu. items: [{ html, value, disabled }] */
export function popover(anchor, title, items, onPick) {
  document.querySelector('.popover')?.remove()
  const node = el('div', { class: 'popover panel', role: 'menu' }, `<h4>${esc(title)}</h4>${items
    .map((it, i) => `<button role="menuitem" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${it.html}</button>`)
    .join('') || '<p class="muted">Nothing available</p>'}`)
  document.getElementById('ui').appendChild(node)
  const r = anchor.getBoundingClientRect()
  const pw = 280
  const left = Math.min(innerWidth - pw - 12, Math.max(12, r.left))
  const top = r.bottom + 8 + 320 > innerHeight ? Math.max(12, r.top - 8 - node.offsetHeight) : r.bottom + 8
  node.style.left = `${left}px`
  node.style.top = `${top}px`
  const close = () => {
    node.remove()
    removeEventListener('pointerdown', outside, true)
  }
  const outside = (e) => {
    if (!node.contains(e.target) && !anchor.contains(e.target)) close()
  }
  setTimeout(() => addEventListener('pointerdown', outside, true), 0)
  node.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]')
    if (!b) return
    onPick(items[Number(b.dataset.i)].value)
    close()
  })
  return node
}
