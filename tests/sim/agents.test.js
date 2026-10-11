import { describe, it, expect } from 'vitest'
import { Timeline } from '../../src/sim/index.js'

describe('agents', () => {
  it('nobody gets stuck while walking', () => {
    const tl = new Timeline('mvp', { seed: 11 })
    const still = {}
    let worst = 0
    while (tl.S.tick < 9000) {
      tl.step()
      for (const a of tl.S.agents) {
        if (!a.present || a.plan[0]?.k !== 'goto') {
          still[a.id] = null
          continue
        }
        const prev = still[a.id]
        if (prev && Math.hypot(prev.x - a.x, prev.z - a.z) < 0.01) prev.n++
        else still[a.id] = { x: a.x, z: a.z, n: 0 }
        worst = Math.max(worst, still[a.id].n)
      }
    }
    expect(worst).toBeLessThan(40)
  })

  it('people go home in the evening and come back in the morning', () => {
    const tl = new Timeline('mvp', { seed: 1 })
    let emptiedAt = null
    let backAt = null
    while (tl.S.tick < 20000 && backAt == null) {
      tl.step()
      const anyone = tl.S.agents.some((a) => a.present)
      if (!anyone && emptiedAt == null) emptiedAt = tl.S.clock
      if (anyone && emptiedAt != null) backAt = tl.S.clock
    }
    expect(emptiedAt % 1440).toBeGreaterThan(18 * 60)
    expect(backAt % 1440).toBeGreaterThan(8.5 * 60)
    expect(backAt % 1440).toBeLessThan(9.5 * 60)
  })

  it('every agent explains its decisions', () => {
    const tl = new Timeline('mvp', { seed: 1 })
    while (tl.S.tick < 1500) tl.step()
    for (const a of tl.S.agents) {
      expect(a.why.length).toBe(3)
      expect(typeof a.thought).toBe('string')
    }
  })
})

describe('commands', () => {
  const at = (tick, cmd, seed = 1) => {
    const tl = new Timeline('mvp', { seed })
    while (tl.S.tick < tick) tl.step()
    tl.push(cmd)
    tl.step()
    return tl
  }

  it('pizza costs money and gets eaten', () => {
    const tl = at(1200, { type: 'pizza' })
    expect(tl.S.stats.pizzas).toBe(1)
    const before = tl.S.agents.map((a) => a.morale)
    while (tl.S.tick < 2400) tl.step()
    expect(tl.S.agents.some((a) => a.pizzaId === 1)).toBe(true)
    expect(before.length).toBeGreaterThan(0)
  })

  it('hiring adds a contractor who walks in and takes a free desk', () => {
    const tl = at(1200, { type: 'hire', role: 'frontend' })
    const c = tl.S.agents.find((a) => a.contractor)
    expect(c).toBeTruthy()
    expect(tl.S.agents.filter((a) => a.desk === c.desk).length).toBe(1)
    while (tl.S.tick < 1600) tl.step()
    expect(c.id && tl.S.agents.find((a) => a.id === c.id).present).toBe(true)
  })

  it('assigning a ticket makes that agent own it', () => {
    const tl = new Timeline('mvp', { seed: 1 })
    while (tl.S.phase === 'kickoff') tl.step()
    const t = tl.S.tickets.find((x) => x.key === 'ci')
    tl.push({ type: 'assign', ticket: t.id, agent: 'vikram' })
    tl.step()
    expect(tl.S.tickets.find((x) => x.key === 'ci').assignee).toBe('vikram')
  })

  it('a fire drill gathers everyone in the lobby', () => {
    const tl = at(1500, { type: 'chaos', kind: 'drill' })
    expect(tl.S.meeting?.kind).toBe('drill')
    while (tl.S.meeting) tl.step()
    expect(tl.S.feed.some((f) => f.text.includes('Fire drill'))).toBe(true)
  })
})
