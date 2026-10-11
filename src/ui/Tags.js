// Name chips and speech bubbles that float over agents' heads in 3D.

import * as THREE from 'three'
import { el, esc, teamColor } from './dom.js'

const BUBBLE_MS = 3200
const _v = new THREE.Vector3()

export class Tags {
  constructor(root, app) {
    this.root = root
    this.app = app
    this.items = new Map()
  }

  update(S, now) {
    const { camera } = this.app.stage
    const heads = this.app.people.headPositions
    const seen = new Set()
    const w = innerWidth
    const h = innerHeight
    for (const a of S.agents) {
      let it = this.items.get(a.id)
      if (!it) {
        const node = el('div', { class: 'tag' }, `<div class="bubble"></div><div class="name" style="--c:${teamColor(a.team)}">${esc(a.first)}</div>`)
        this.root.appendChild(node)
        it = { node, bubble: node.firstChild, sayId: a.sayId, until: 0 }
        this.items.set(a.id, it)
      }
      seen.add(a.id)
      const head = heads.get(a.id)
      if (!head || !a.present || a.hidden) {
        it.node.style.display = 'none'
        continue
      }
      if (a.sayId !== it.sayId && a.say) {
        it.sayId = a.sayId
        it.until = now + BUBBLE_MS
        it.bubble.textContent = a.say
      }
      _v.copy(head)
      _v.y += 0.32
      const dist = _v.distanceTo(camera.position)
      _v.project(camera)
      if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) {
        it.node.style.display = 'none'
        continue
      }
      const x = ((_v.x + 1) / 2) * w
      const y = ((1 - _v.y) / 2) * h
      const focus = a.id === this.app.selected || a.id === this.app.hover
      it.node.style.display = ''
      it.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      it.node.style.opacity = focus ? 1 : Math.max(0.35, Math.min(1, 1.6 - dist / 40))
      it.node.classList.toggle('focus', focus)
      it.node.classList.toggle('talking', now < it.until)
    }
    for (const [id, it] of this.items) if (!seen.has(id)) (it.node.remove(), this.items.delete(id))
  }

  clear() {
    for (const it of this.items.values()) it.node.remove()
    this.items.clear()
  }
}
