// Bottom dock: CEO actions, speed controls and the timeline scrubber.

import { PRICES, clock as C, TICKS_PER_SECOND } from '../sim/index.js'
import { el, patch } from './dom.js'

const SPEEDS = [1, 2, 4, 8]

export class Dock {
  constructor(root, app) {
    this.app = app
    this.node = el('div', { class: 'dock' })
    root.appendChild(this.node)
    this.node.innerHTML = `
      <div class="actions-bar panel" role="toolbar" aria-label="CEO actions">
        <button data-cmd="pizza" title="Order pizza — energy & morale boost">🍕<span class="lbl"> Pizza</span> <small>$${PRICES.pizza}</small></button>
        <button data-cmd="allhands" title="Gather everyone for an all-hands — morale up, time lost">📣<span class="lbl"> All-hands</span></button>
        <button data-cmd="hire" title="Hire a contractor ($${PRICES.hire} + $110/h)">➕<span class="lbl"> Hire</span> <small>$${PRICES.hire}</small></button>
        <button data-cmd="crunch" title="Crunch mode — the team stays until ~22:00">🔥<span class="lbl"> Crunch</span></button>
        <button data-cmd="chaos" title="Something unexpected happens…">🎲<span class="lbl"> Chaos</span></button>
      </div>
      <div class="time panel">
        <div class="speeds" role="group" aria-label="Speed">
          <button data-speed="0" title="Pause (Space)">⏸</button>
          ${SPEEDS.map((s, i) => `<button data-speed="${s}" title="${s}× (${i + 1})">${s}×</button>`).join('')}
        </div>
        <input class="scrub" type="range" min="0" max="1" value="0" step="1" aria-label="Timeline" />
        <span class="scrub-label mono"></span>
        <button class="live" title="Jump back to the present">● LIVE</button>
      </div>`
    this.scrub = this.node.querySelector('.scrub')
    this.label = this.node.querySelector('.scrub-label')
    this.liveBtn = this.node.querySelector('.live')
    this.dragging = false
    this.speed = 1
    this.paused = false

    this.node.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      app.sound.ui()
      if (b.dataset.speed != null) return this.setSpeed(Number(b.dataset.speed))
      const cmd = b.dataset.cmd
      if (cmd === 'hire') return app.ui.hireMenu(b)
      if (cmd === 'crunch') return app.command({ type: 'crunch', on: !app.state?.crunch })
      if (cmd) app.command({ type: cmd })
    })
    this.liveBtn.addEventListener('click', () => app.sim.seek(app.frame?.maxTick ?? 0))
    this.scrub.addEventListener('pointerdown', () => (this.dragging = true))
    this.scrub.addEventListener('input', () => {
      clearTimeout(this.seekTimer)
      this.seekTimer = setTimeout(() => app.sim.seek(Number(this.scrub.value)), 40)
    })
    addEventListener('pointerup', () => (this.dragging = false))
  }

  setSpeed(s) {
    if (s === 0) {
      this.paused = !this.paused
      this.app.sim.pause(this.paused)
    } else {
      this.paused = false
      this.speed = s
      this.app.sim.pause(false)
      this.app.sim.setSpeed(s)
    }
  }

  update(frame) {
    const S = frame.state
    for (const b of this.node.querySelectorAll('[data-speed]')) {
      const s = Number(b.dataset.speed)
      b.classList.toggle('active', s === 0 ? frame.paused : !frame.paused && frame.speed === s)
    }
    this.node.querySelector('[data-cmd=crunch]').classList.toggle('active', S.crunch)
    const replay = frame.tick < frame.maxTick
    this.scrub.max = Math.max(1, frame.maxTick)
    if (!this.dragging) this.scrub.value = frame.tick
    this.scrub.style.setProperty('--p', `${(frame.tick / Math.max(1, frame.maxTick)) * 100}%`)
    this.liveBtn.classList.toggle('on', !replay)
    const ago = (frame.maxTick - frame.tick) / TICKS_PER_SECOND
    patch(this.label, replay ? `replay · −${Math.round(ago)}s` : C.fmtTime(S.clock))
    this.node.classList.toggle('replaying', replay)
  }
}
