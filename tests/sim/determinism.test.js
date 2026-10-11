import { describe, it, expect } from 'vitest'
import { Timeline } from '../../src/sim/index.js'

const fingerprint = (S) => JSON.stringify({ tick: S.tick, clock: S.clock, rng: S.rng, agents: S.agents, tickets: S.tickets, budget: S.budget })

function run(seed, ticks, cmdsAt = {}) {
  const tl = new Timeline('mvp', { seed })
  while (tl.S.tick < ticks) {
    for (const c of cmdsAt[tl.S.tick] || []) tl.push(c)
    tl.step()
  }
  return tl
}

describe('determinism', () => {
  it('same seed + same commands ⇒ identical world', () => {
    const cmds = { 1500: [{ type: 'pizza' }], 2500: [{ type: 'chaos', kind: 'drill' }] }
    expect(fingerprint(run(5, 4000, cmds).S)).toEqual(fingerprint(run(5, 4000, cmds).S))
  })

  it('different seeds diverge', () => {
    expect(fingerprint(run(1, 3000).S)).not.toEqual(fingerprint(run(2, 3000).S))
  })

  it('state survives structuredClone (plain JSON only)', () => {
    const S = run(1, 2000).S
    expect(JSON.parse(JSON.stringify(S))).toEqual(structuredClone(S))
  })
})

describe('timeline', () => {
  it('seeking back and replaying reproduces the linear run exactly', () => {
    const cmds = { 700: [{ type: 'pizza' }], 1900: [{ type: 'crunch', on: true }] }
    const linear = run(9, 3000, cmds)
    const tl = run(9, 3000, cmds)
    tl.seek(650)
    expect(tl.S.tick).toBe(650)
    while (tl.S.tick < 3000) tl.step()
    expect(fingerprint(tl.S)).toEqual(fingerprint(linear.S))
  })

  it('a command after a rewind branches the future', () => {
    const tl = run(3, 2000, { 1200: [{ type: 'pizza' }] })
    tl.seek(1000)
    tl.push({ type: 'allhands' })
    expect(tl.maxTick).toBe(1000)
    expect([...tl.cmds.keys()].every((k) => k <= 1000)).toBe(true)
  })

  it('serialize → from replays the same run', () => {
    const tl = run(4, 2500, { 900: [{ type: 'pizza' }] })
    const copy = Timeline.from(tl.serialize())
    while (copy.S.tick < 2500) copy.step()
    expect(fingerprint(copy.S)).toEqual(fingerprint(tl.S))
  })
})
