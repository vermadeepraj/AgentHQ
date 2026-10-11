// Navigation: a 0.5 m walkability grid rasterised from the layout, A* with an
// octile heuristic (no corner cutting), line-of-sight smoothing, and exact end
// points (seats sit just inside furniture padding, so the last leg is direct).

import { BOUNDS, walls, furniture, footprint, WALL_THICKNESS } from './layout.js'

export const CELL = 0.5
export const COLS = Math.round((BOUNDS.maxX - BOUNDS.minX) / CELL)
export const ROWS = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / CELL)

const AGENT_RADIUS = 0.3
const FURNITURE_PAD = 0.2

/** 1 = walkable, 0 = blocked. */
export const grid = new Uint8Array(COLS * ROWS).fill(1)

const cx = (i) => BOUNDS.minX + (i + 0.5) * CELL
const cz = (j) => BOUNDS.minZ + (j + 0.5) * CELL
const idx = (i, j) => j * COLS + i
const inside = (i, j) => i >= 0 && j >= 0 && i < COLS && j < ROWS

function blockRect(minX, maxX, minZ, maxZ) {
  for (let j = 0; j < ROWS; j++) {
    const z = cz(j)
    if (z < minZ || z > maxZ) continue
    for (let i = 0; i < COLS; i++) {
      const x = cx(i)
      if (x >= minX && x <= maxX) grid[idx(i, j)] = 0
    }
  }
}

for (const w of walls) {
  const pad = WALL_THICKNESS / 2 + AGENT_RADIUS
  blockRect(Math.min(w.x1, w.x2) - pad, Math.max(w.x1, w.x2) + pad, Math.min(w.z1, w.z2) - pad, Math.max(w.z1, w.z2) + pad)
}
for (const f of furniture) {
  if (!f.block) continue
  const b = footprint(f)
  blockRect(b.minX - FURNITURE_PAD, b.maxX + FURNITURE_PAD, b.minZ - FURNITURE_PAD, b.maxZ + FURNITURE_PAD)
}

export function cellOf(x, z) {
  const i = Math.min(COLS - 1, Math.max(0, Math.floor((x - BOUNDS.minX) / CELL)))
  const j = Math.min(ROWS - 1, Math.max(0, Math.floor((z - BOUNDS.minZ) / CELL)))
  return [i, j]
}

export function walkable(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return false
  const [i, j] = cellOf(x, z)
  return grid[idx(i, j)] === 1
}

/** Nearest walkable cell to (i, j) by expanding square rings. */
export function nearestWalkableCell(i, j) {
  if (grid[idx(i, j)]) return [i, j]
  for (let r = 1; r < 12; r++) {
    let best = null
    let bestD = Infinity
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
        const ni = i + di
        const nj = j + dj
        if (!inside(ni, nj) || !grid[idx(ni, nj)]) continue
        const d = di * di + dj * dj
        if (d < bestD) (bestD = d), (best = [ni, nj])
      }
    }
    if (best) return best
  }
  return [i, j]
}

/** Snap a point to the centre of the nearest walkable cell (used for crowd spots). */
export function snapWalkable(x, z) {
  const [i, j] = nearestWalkableCell(...cellOf(x, z))
  return walkable(x, z) ? { x, z } : { x: cx(i), z: cz(j) }
}

// ── A* ───────────────────────────────────────────────────────────────────
const SQRT2 = Math.SQRT2
const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
]
const gScore = new Float32Array(COLS * ROWS)
const came = new Int32Array(COLS * ROWS)
const closed = new Uint8Array(COLS * ROWS)

function octile(i, j, gi, gj) {
  const dx = Math.abs(i - gi)
  const dz = Math.abs(j - gj)
  return dx + dz + (SQRT2 - 2) * Math.min(dx, dz)
}

function astar(si, sj, gi, gj) {
  gScore.fill(Infinity)
  came.fill(-1)
  closed.fill(0)
  const start = idx(si, sj)
  const goal = idx(gi, gj)
  // Binary heap of [f, node].
  const heap = [[octile(si, sj, gi, gj), start]]
  gScore[start] = 0
  const push = (item) => {
    heap.push(item)
    let k = heap.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heap[p][0] <= heap[k][0]) break
      ;[heap[p], heap[k]] = [heap[k], heap[p]]
      k = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = 2 * k + 1
        const r = l + 1
        let m = k
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === k) break
        ;[heap[m], heap[k]] = [heap[k], heap[m]]
        k = m
      }
    }
    return top
  }

  while (heap.length) {
    const [, node] = pop()
    if (node === goal) break
    if (closed[node]) continue
    closed[node] = 1
    const i = node % COLS
    const j = (node / COLS) | 0
    for (const [di, dj, cost] of NEIGHBOURS) {
      const ni = i + di
      const nj = j + dj
      if (!inside(ni, nj) || !grid[idx(ni, nj)]) continue
      if (di && dj && (!grid[idx(i + di, j)] || !grid[idx(i, j + dj)])) continue // no corner cutting
      const n = idx(ni, nj)
      const g = gScore[node] + cost
      if (g < gScore[n]) {
        gScore[n] = g
        came[n] = node
        push([g + octile(ni, nj, gi, gj), n])
      }
    }
  }
  if (start !== goal && came[goal] === -1) return null
  const cells = []
  for (let n = goal; n !== -1; n = came[n]) {
    cells.push(n)
    if (n === start) break
  }
  return cells.reverse().map((n) => ({ x: cx(n % COLS), z: cz((n / COLS) | 0) }))
}

export function lineOfSight(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z)
  const steps = Math.ceil(d / 0.15)
  for (let s = 1; s < steps; s++) {
    const t = s / steps
    if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false
  }
  return true
}

function smooth(points) {
  if (points.length <= 2) return points
  const out = [points[0]]
  let i = 0
  while (i < points.length - 1) {
    let j = points.length - 1
    while (j > i + 1 && !lineOfSight(points[i], points[j])) j--
    out.push(points[j])
    i = j
  }
  return out
}

const cache = new Map()

/**
 * Waypoints from `from` to `to` (excluding the start, ending exactly at `to`).
 * Pure function of the inputs — safe for deterministic simulation.
 */
export function findPath(from, to) {
  const [si, sj] = nearestWalkableCell(...cellOf(from.x, from.z))
  const [gi, gj] = nearestWalkableCell(...cellOf(to.x, to.z))
  const key = `${si},${sj},${gi},${gj}`
  let core = cache.get(key)
  if (!core) {
    core = smooth(astar(si, sj, gi, gj) || [])
    if (cache.size > 4000) cache.clear()
    cache.set(key, core)
  }
  // Drop the first centre if we can already see the second one from where we stand.
  const pts = core.slice()
  if (pts.length > 1 && lineOfSight(from, pts[1])) pts.shift()
  return [...pts.map((p) => ({ x: p.x, z: p.z })), { x: to.x, z: to.z }]
}
