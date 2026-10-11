// Canvas-texture boards that mirror simulation state: Kanban, whiteboard,
// lobby screen, conference TV. Each redraws only when its input key changes.

import * as THREE from 'three'
import { clock as C } from '../../sim/index.js'

export const TYPE_COLORS = {
  product: '#ffb547', design: '#ff6fd8', frontend: '#5ee7ff', backend: '#6f9bff', ops: '#a98bff', qa: '#54ffb0',
}
const HAND = '"Caveat", "Segoe Print", "Comic Sans MS", cursive'
const SANS = '"Manrope", "Segoe UI", system-ui, sans-serif'
const MONO = '"JetBrains Mono", Consolas, monospace'

class Board {
  constructor(w, h, draw) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.g = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 8
    this.drawFn = draw
    this.key = null
  }

  update(key, ...args) {
    if (key === this.key) return
    this.key = key
    this.drawFn(this.g, this.canvas.width, this.canvas.height, ...args)
    this.texture.needsUpdate = true
  }
}

function fit(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

const initials = (agents, id) => {
  const a = agents.find((x) => x.id === id)
  return a ? a.name.split(' ').map((p) => p[0]).join('') : ''
}

// ── Kanban ──────────────────────────────────────────────────────────────
const COLUMNS = [['todo', 'To do'], ['doing', 'In progress'], ['review', 'Review'], ['qa', 'QA'], ['done', 'Done']]

function drawKanban(g, w, h, state) {
  g.fillStyle = '#f4f3ef'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#20232a'
  g.font = `700 34px ${SANS}`
  g.fillText(`${state.scenario.client} — Sprint board`, 28, 50)
  g.font = `500 22px ${MONO}`
  g.fillStyle = '#6b6f78'
  const done = state.tickets.filter((t) => t.status === 'done').length
  const label = `${done}/${state.tickets.length} done`
  g.fillText(label, w - 28 - g.measureText(label).width, 48)
  if (!state.tickets.length) {
    g.font = `48px ${HAND}`
    g.fillStyle = '#9aa0a8'
    g.fillText('Waiting for kickoff…', w / 2 - 190, h / 2)
    return
  }
  const colW = (w - 40) / COLUMNS.length
  COLUMNS.forEach(([status, title], ci) => {
    const x = 20 + ci * colW
    g.fillStyle = '#e6e4de'
    roundRect(g, x + 6, 72, colW - 12, h - 90, 12)
    g.fill()
    g.fillStyle = '#3b3f48'
    g.font = `700 22px ${SANS}`
    const cards = state.tickets.filter((t) => t.status === status)
    g.fillText(`${title}  ${cards.length}`, x + 20, 104)
    const maxCards = Math.floor((h - 140) / 50)
    cards.slice(0, maxCards).forEach((t, k) => {
      const y = 120 + k * 50
      g.fillStyle = '#ffffff'
      roundRect(g, x + 14, y, colW - 28, 44, 7)
      g.fill()
      g.fillStyle = TYPE_COLORS[t.type] || '#999'
      g.fillRect(x + 14, y, 7, 44)
      g.fillStyle = '#20232a'
      g.font = `600 17px ${SANS}`
      g.fillText(fit(g, t.title, colW - 92), x + 30, y + 20)
      g.font = `500 13px ${MONO}`
      g.fillStyle = '#80848c'
      g.fillText(`${t.id}${t.reworks ? ' 🐞' + t.reworks : ''}`, x + 30, y + 37)
      const who = initials(state.agents, t.assignee)
      if (who) {
        g.fillStyle = '#20232a'
        g.beginPath()
        g.arc(x + colW - 36, y + 22, 14, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#fff'
        g.font = `700 12px ${SANS}`
        g.fillText(who, x + colW - 36 - g.measureText(who).width / 2, y + 26)
      }
      if (status === 'doing') {
        g.fillStyle = '#e3e5e8'
        g.fillRect(x + 30, y + 40, colW - 100, 3)
        g.fillStyle = TYPE_COLORS[t.type]
        g.fillRect(x + 30, y + 40, (colW - 100) * Math.min(1, t.progress / t.effort), 3)
      }
    })
    if (cards.length > maxCards) {
      g.fillStyle = '#80848c'
      g.font = `600 16px ${SANS}`
      g.fillText(`+${cards.length - maxCards} more`, x + 20, h - 26)
    }
  })
}

// ── Whiteboard ──────────────────────────────────────────────────────────
function drawWhiteboard(g, w, h, lines, client) {
  g.fillStyle = '#fbfbf9'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(0,0,0,0.04)'
  for (let i = 0; i < 6; i++) {
    g.beginPath()
    g.moveTo(Math.random() * w, Math.random() * h)
    g.lineTo(Math.random() * w, Math.random() * h)
    g.stroke()
  }
  if (!lines.length) {
    g.font = `52px ${HAND}`
    g.fillStyle = '#c4c8cf'
    g.fillText(`${client} — ideas?`, 60, 120)
    return
  }
  const markers = ['#1f4fbf', '#20232a', '#c0392b', '#1e8449']
  lines.forEach((line, i) => {
    g.fillStyle = i === 0 || i === lines.length - 1 ? '#c0392b' : markers[i % markers.length]
    g.font = `${i === 0 ? 56 : 38}px ${HAND}`
    g.fillText(fit(g, line, w - 80), 44, i === 0 ? 70 : 100 + i * 60)
  })
  g.strokeStyle = '#c0392b'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(44, 86)
  g.quadraticCurveTo(w / 3, 96, w / 2, 84)
  g.stroke()
}

// ── Lobby screen ────────────────────────────────────────────────────────
function drawLobby(g, w, h, state) {
  const o = state.outage
  if (o && o.active) {
    g.fillStyle = '#3a0b10'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ff4f6d'
    g.font = `800 92px ${SANS}`
    g.fillText('CHECKOUT DOWN', 70, 250)
    g.font = `500 44px ${MONO}`
    g.fillStyle = '#ffd1d9'
    g.fillText(`down for ${C.fmtDuration(state.clock - o.since)}`, 74, 340)
    g.fillText(`revenue lost  $${Math.round(state.loss).toLocaleString()}`, 74, 410)
    return
  }
  if (state.launchedAt != null) return drawSite(g, w, h, state.scenario.site)
  if (o && o.resolvedAt != null) {
    g.fillStyle = '#062417'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#54ffb0'
    g.font = `800 76px ${SANS}`
    g.fillText('ALL SYSTEMS OPERATIONAL', 70, 260)
    g.font = `500 40px ${MONO}`
    g.fillStyle = '#c9ffe6'
    g.fillText(`restored after ${C.fmtDuration(o.resolvedAt - o.since)}`, 74, 340)
    return
  }
  const total = state.tickets.length
  const done = state.tickets.filter((t) => t.status === 'done').length
  g.fillStyle = '#0b0f17'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#7cf7ff'
  g.font = `600 30px ${MONO}`
  g.fillText('NOW BUILDING', 70, 110)
  g.fillStyle = '#ffffff'
  g.font = `800 96px ${SANS}`
  g.fillText(fit(g, state.scenario.client, w - 140), 66, 215)
  g.fillStyle = '#1b2230'
  roundRect(g, 70, 270, w - 140, 26, 13)
  g.fill()
  g.fillStyle = '#7cf7ff'
  roundRect(g, 70, 270, Math.max(26, (w - 140) * (total ? done / total : 0)), 26, 13)
  g.fill()
  g.font = `500 32px ${MONO}`
  g.fillStyle = '#aab4c5'
  g.fillText(`${done}/${total || '–'} tickets shipped`, 70, 350)
  const left = state.scenario.deadline - state.clock
  g.fillText(`deadline in ${C.fmtDuration(left)}`, 70, 400)
  const recent = state.tickets.filter((t) => t.status === 'done').slice(-4).reverse()
  g.font = `500 28px ${SANS}`
  recent.forEach((t, i) => {
    g.fillStyle = TYPE_COLORS[t.type]
    g.fillText(`✓ ${t.title}`, 70, 480 + i * 48)
  })
}

function drawSite(g, w, h, site) {
  g.fillStyle = site.bg
  g.fillRect(0, 0, w, h)
  const grad = g.createRadialGradient(w * 0.75, h * 0.4, 20, w * 0.75, h * 0.4, w * 0.5)
  grad.addColorStop(0, site.accent + '66')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  g.fillStyle = site.ink
  g.font = `800 40px ${SANS}`
  g.fillText(site.name, 60, 80)
  g.font = `500 26px ${SANS}`
  let nx = w - 60
  for (const n of site.nav.slice().reverse()) {
    nx -= g.measureText(n).width
    g.fillText(n, nx, 78)
    nx -= 44
  }
  g.font = `800 84px ${SANS}`
  const words = site.tagline.split(' ')
  let line = ''
  let y = 250
  for (const word of words) {
    if (g.measureText(line + word).width > w * 0.6) {
      g.fillText(line, 60, y)
      line = ''
      y += 92
    }
    line += word + ' '
  }
  g.fillText(line, 60, y)
  g.fillStyle = site.accent
  roundRect(g, 60, y + 60, 300, 76, 38)
  g.fill()
  g.fillStyle = site.bg
  g.font = `700 32px ${SANS}`
  g.fillText(fit(g, `${site.cta || 'Get started'} →`, 240), 96, y + 110)
  for (let i = 0; i < 3; i++) {
    g.fillStyle = site.ink + '18'
    roundRect(g, w * 0.66 + (i % 2) * 40, 170 + i * 150, w * 0.28, 120, 18)
    g.fill()
    g.fillStyle = site.accent
    g.fillRect(w * 0.66 + (i % 2) * 40 + 24, 200 + i * 150, 80, 12)
    if (site.features?.[i]) {
      g.fillStyle = site.ink
      g.font = `700 26px ${SANS}`
      g.fillText(fit(g, site.features[i], w * 0.28 - 48), w * 0.66 + (i % 2) * 40 + 24, 256 + i * 150)
    }
  }
  g.fillStyle = site.accent
  g.font = `700 26px ${MONO}`
  g.fillText('● LIVE', w - 160, h - 40)
}

// ── Conference TV ───────────────────────────────────────────────────────
function drawTv(g, w, h, state) {
  g.fillStyle = '#10141c'
  g.fillRect(0, 0, w, h)
  if (state.meeting?.kind === 'kickoff') {
    g.fillStyle = '#ffb547'
    g.font = `700 26px ${MONO}`
    g.fillText('KICKOFF', 36, 60)
    g.fillStyle = '#ffffff'
    g.font = `800 44px ${SANS}`
    g.fillText(fit(g, state.scenario.client, w - 72), 36, 130)
    g.font = `500 22px ${SANS}`
    g.fillStyle = '#b8c0cc'
    const words = state.scenario.brief.split(' ')
    let line = ''
    let y = 180
    for (const word of words) {
      if (g.measureText(line + word).width > w - 72) {
        g.fillText(line, 36, y)
        line = ''
        y += 30
      }
      line += word + ' '
    }
    g.fillText(line, 36, y)
    return
  }
  // Burn-up chart of shipped tickets.
  const total = Math.max(1, state.tickets.length)
  const done = state.tickets.filter((t) => t.status === 'done').length
  g.fillStyle = '#7cf7ff'
  g.font = `700 24px ${MONO}`
  g.fillText('BURN-UP', 36, 52)
  g.fillStyle = '#1d2533'
  g.fillRect(36, 80, w - 72, h - 120)
  g.strokeStyle = '#3c4658'
  g.setLineDash([8, 8])
  g.beginPath()
  g.moveTo(36, h - 40)
  g.lineTo(w - 36, 80)
  g.stroke()
  g.setLineDash([])
  const t = Math.min(1, (state.clock - state.scenario.start) / (state.scenario.deadline - state.scenario.start))
  g.strokeStyle = '#54ffb0'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(36, h - 40)
  g.lineTo(36 + (w - 72) * t, h - 40 - (h - 120) * (done / total))
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = `800 40px ${SANS}`
  g.fillText(`${Math.round((done / total) * 100)}%`, w - 150, 54)
}

export function createBoards() {
  const kanban = new Board(1600, 704, drawKanban)
  const whiteboard = new Board(1024, 555, drawWhiteboard)
  const lobby = new Board(1280, 720, drawLobby)
  const tv = new Board(640, 360, drawTv)
  return {
    kanban, whiteboard, lobby, tv,
    update(state) {
      const tk = state.tickets.map((t) => `${t.id}${t.status}${Math.floor((t.progress / t.effort) * 10)}${t.assignee}${t.reworks}`).join('|')
      kanban.update(tk, state)
      whiteboard.update(state.whiteboard.join('|'), state.whiteboard, state.scenario.client)
      const minute = Math.floor(state.clock)
      lobby.update(`${tk}|${state.launchedAt}|${state.outage?.active}|${state.outage?.resolvedAt}|${Math.floor(minute / 5)}`, state)
      tv.update(`${tk}|${state.meeting?.kind}|${Math.floor(minute / 10)}`, state)
    },
  }
}
