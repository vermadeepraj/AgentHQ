// Procedural canvas textures — no image assets to download.

import * as THREE from 'three'

function canvas(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return c
}

function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Light oak planks. One canvas = 4 m × 4 m. */
export function woodFloor() {
  const r = seeded(7)
  const c = canvas(1024, 1024, (g, w, h) => {
    const rows = 20
    const rh = h / rows
    for (let i = 0; i < rows; i++) {
      let x = -r() * 300
      while (x < w) {
        const len = 260 + r() * 260
        const l = 70 + r() * 8
        g.fillStyle = `hsl(${30 + r() * 6}, ${32 + r() * 10}%, ${l}%)`
        g.fillRect(x, i * rh, len, rh)
        g.globalAlpha = 0.08
        for (let k = 0; k < 6; k++) {
          g.fillStyle = r() > 0.5 ? '#5a3c22' : '#fff4e0'
          g.fillRect(x, i * rh + r() * rh, len, 1 + r() * 2)
        }
        g.globalAlpha = 1
        g.fillStyle = 'rgba(70,45,25,0.35)'
        g.fillRect(x, i * rh, 2, rh)
        x += len
      }
      g.fillStyle = 'rgba(70,45,25,0.3)'
      g.fillRect(0, i * rh, w, 1.5)
    }
  })
  return toTexture(c)
}

/** Fine-grained carpet tiles. One canvas = 2 m. */
export function carpet(base = '#4b5566') {
  const r = seeded(13)
  const c = canvas(256, 256, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
      g.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)'
    g.strokeRect(0, 0, w, h)
  })
  return toTexture(c)
}

/** Square tiles with grout. One canvas = 1.2 m. */
export function tiles(base = '#e9e6df', grout = '#c9c4ba', n = 4) {
  const r = seeded(21)
  const c = canvas(256, 256, (g, w, h) => {
    g.fillStyle = grout
    g.fillRect(0, 0, w, h)
    const s = w / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = base
        g.globalAlpha = 0.92 + r() * 0.08
        g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4)
      }
    g.globalAlpha = 1
  })
  return toTexture(c)
}

/** Polished concrete. One canvas = 4 m. */
export function concrete() {
  const r = seeded(5)
  const c = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#b9bcc0'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 260; i++) {
      const x = r() * w
      const y = r() * h
      const rad = 10 + r() * 60
      const grad = g.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    g.strokeStyle = 'rgba(0,0,0,0.1)'
    g.lineWidth = 2
    g.strokeRect(0, 0, w, h)
  })
  return toTexture(c)
}

/** Outdoor paving around the building. */
export function paving() {
  const r = seeded(9)
  const c = canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#6b6f73'
    g.fillRect(0, 0, w, h)
    const s = w / 4
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 8; j++) {
        g.fillStyle = `hsl(210, 4%, ${40 + r() * 8}%)`
        g.fillRect(i * s + ((j % 2) * s) / 2 + 1, (j * s) / 2 + 1, s - 2, s / 2 - 2)
      }
  })
  return toTexture(c)
}

/** A whole board of fake code lines, used by engineering monitors (scrolls via offset). */
export function codeScreen() {
  const r = seeded(3)
  const palette = ['#7cf7ff', '#c792ea', '#ffcb6b', '#82aaff', '#c3e88d', '#f78c6c', '#a6accd']
  const c = canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#0d1117'
    g.fillRect(0, 0, w, h)
    for (let y = 6; y < h; y += 9) {
      let x = 8 + Math.floor(r() * 4) * 10
      const n = 1 + Math.floor(r() * 5)
      for (let k = 0; k < n && x < w - 10; k++) {
        const len = 10 + r() * 50
        g.fillStyle = palette[Math.floor(r() * palette.length)]
        g.globalAlpha = 0.85
        g.fillRect(x, y, len, 4)
        x += len + 6
      }
    }
    g.globalAlpha = 1
  })
  const t = toTexture(c, 1, 0.5)
  return t
}

/** Design tool: artboards and swatches. */
export function designScreen() {
  const c = canvas(512, 320, (g, w, h) => {
    g.fillStyle = '#1e1e24'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#2b2b33'
    g.fillRect(0, 0, 70, h)
    g.fillRect(w - 90, 0, 90, h)
    const boards = [['#fdf6ec', 110, 40, 150, 230], ['#ffffff', 280, 40, 120, 110], ['#ffe2cc', 280, 165, 120, 105]]
    for (const [col, x, y, bw, bh] of boards) {
      g.fillStyle = col
      g.fillRect(x, y, bw, bh)
      g.fillStyle = '#e08a3c'
      g.fillRect(x + 10, y + 12, bw * 0.5, 10)
      g.fillStyle = '#c9c1b6'
      for (let i = 0; i < 4; i++) g.fillRect(x + 10, y + 34 + i * 12, bw - 30 - i * 12, 5)
    }
    const sw = ['#ff6fd8', '#ffb547', '#5ee7ff', '#54ffb0', '#a98bff']
    sw.forEach((s, i) => {
      g.fillStyle = s
      g.fillRect(w - 75, 20 + i * 28, 60, 18)
    })
  })
  return toTexture(c)
}

/** Dashboards: graphs and status tiles (QA, ops, product). */
export function dashScreen(accent = '#54ffb0') {
  const r = seeded(17)
  const c = canvas(512, 320, (g, w, h) => {
    g.fillStyle = '#0f141a'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#18212b'
      g.fillRect(12 + i * 124, 12, 112, 60)
      g.fillStyle = accent
      g.fillRect(22 + i * 124, 50, 40 + r() * 50, 8)
    }
    g.strokeStyle = accent
    g.lineWidth = 3
    g.beginPath()
    for (let x = 0; x <= 480; x += 16) g.lineTo(16 + x, 220 - Math.sin(x / 40) * 30 - r() * 30)
    g.stroke()
    g.fillStyle = '#18212b'
    g.fillRect(12, 250, w - 24, 58)
    for (let i = 0; i < 20; i++) {
      g.fillStyle = r() > 0.85 ? '#ff4f6d' : accent
      g.fillRect(20 + i * 24, 300 - r() * 40, 14, 40)
    }
  })
  return toTexture(c)
}
