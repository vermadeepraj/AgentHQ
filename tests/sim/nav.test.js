import { describe, it, expect } from 'vitest'
import { spots, EXIT } from '../../src/sim/world/layout.js'
import { findPath, walkable, lineOfSight } from '../../src/sim/world/nav.js'

const ids = Object.keys(spots)

describe('navigation', () => {
  it('reaches every interaction spot from the entrance and back', () => {
    for (const id of ids) {
      const there = findPath(EXIT, spots[id])
      const back = findPath(spots[id], EXIT)
      expect(there.length, id).toBeGreaterThan(0)
      expect(there.at(-1)).toEqual({ x: spots[id].x, z: spots[id].z })
      expect(back.at(-1)).toEqual({ x: EXIT.x, z: EXIT.z })
    }
  })

  it('never routes through walls or furniture between waypoints', () => {
    for (let k = 0; k < ids.length; k += 3) {
      const a = spots[ids[k]]
      const b = spots[ids[(k * 7 + 5) % ids.length]]
      const path = findPath(a, b)
      // Interior legs (cell centre → cell centre) must be fully walkable.
      for (let i = 1; i < path.length - 2; i++) expect(lineOfSight(path[i], path[i + 1]), `${ids[k]} leg ${i}`).toBe(true)
    }
  })

  it('treats the outside of the building as blocked', () => {
    expect(walkable(-30, 0)).toBe(false)
    expect(walkable(0, 30)).toBe(false)
  })
})
