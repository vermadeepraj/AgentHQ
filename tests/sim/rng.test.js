import { describe, it, expect } from 'vitest'
import { rand, randInt } from '../../src/sim/rng.js'

describe('rng', () => {
  it('is reproducible from the same seed', () => {
    const a = { rng: 42 }
    const b = { rng: 42 }
    const xs = Array.from({ length: 50 }, () => rand(a))
    const ys = Array.from({ length: 50 }, () => rand(b))
    expect(xs).toEqual(ys)
  })

  it('stays in [0, 1) and covers the range', () => {
    const s = { rng: 7 }
    const xs = Array.from({ length: 5000 }, () => rand(s))
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    expect(xs.filter((x) => x < 0.5).length).toBeGreaterThan(2300)
    expect(xs.filter((x) => x < 0.5).length).toBeLessThan(2700)
  })

  it('randInt is inclusive', () => {
    const s = { rng: 3 }
    const seen = new Set(Array.from({ length: 500 }, () => randInt(s, 1, 3)))
    expect([...seen].sort()).toEqual([1, 2, 3])
  })
})
