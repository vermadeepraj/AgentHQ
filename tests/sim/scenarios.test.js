import { describe, it, expect } from 'vitest'
import { Timeline } from '../../src/sim/index.js'
import { fmtClock, fmtDuration } from '../../src/sim/clock.js'
import { runScenario } from './helpers.js'

const SEEDS = [1, 2, 3, 4]
const report = []

describe('scenarios — balance targets (docs/PLAN.md §11)', () => {
  it('MVP: an untouched team usually ships on time', () => {
    const wins = SEEDS.filter((seed) => {
      const S = runScenario('mvp', { seed }).S
      report.push(`mvp      seed ${seed}: ${S.outcome.grade} ${S.outcome.score}  ${S.launchedAt ? 'live ' + fmtClock(S.launchedAt) : 'missed'}`)
      return S.outcome.result === 'win'
    })
    expect(wins.length).toBeGreaterThanOrEqual(3)
  })

  it('Crunch: an untouched team misses the demo', () => {
    for (const seed of SEEDS.slice(0, 2)) {
      const S = runScenario('crunch', { seed }).S
      report.push(`crunch   seed ${seed}: ${S.outcome.grade} (untouched)`)
      expect(S.outcome.result).toBe('fail')
    }
  })

  it('Crunch: crunch mode + contractors + pizza can win it', () => {
    const wins = SEEDS.slice(0, 3).filter((seed) => {
      const tl = new Timeline('crunch', { seed })
      for (const c of [{ type: 'crunch', on: true }, { type: 'hire', role: 'frontend' }, { type: 'hire', role: 'backend' }, { type: 'hire', role: 'qa' }]) tl.push(c)
      let pizzaDay = 0
      while (!tl.S.outcome) {
        const day = Math.floor(tl.S.clock / 1440)
        if (tl.S.clock % 1440 > 16 * 60 && pizzaDay <= day) (pizzaDay = day + 1), tl.push({ type: 'pizza' })
        tl.step()
      }
      report.push(`crunch   seed ${seed}: ${tl.S.outcome.grade} (managed)`)
      return tl.S.outcome.result === 'win'
    })
    expect(wins.length).toBeGreaterThanOrEqual(2)
  })

  it('Outage: paging engineers early cuts downtime', () => {
    const downtime = (paging) => {
      const tl = new Timeline('outage', { seed: 1 })
      while (!tl.S.outcome) {
        if (paging && tl.S.tick === 40) for (const agent of ['ananya', 'vikram']) tl.push({ type: 'page', agent })
        tl.step()
      }
      return tl.S.outage.resolvedAt - tl.S.outage.since
    }
    const idle = downtime(false)
    const managed = downtime(true)
    report.push(`outage   downtime untouched ${fmtDuration(idle)}, paged early ${fmtDuration(managed)}`)
    expect(managed).toBeLessThan(idle - 30)
  })

  it('Scope creep: the decision is applied and the project ends', () => {
    for (const option of ['accept', 'negotiate']) {
      const tl = new Timeline('scope', { seed: 2 })
      while (!tl.S.outcome) {
        if (tl.S.decision) tl.push({ type: 'decide', id: 'scope', option })
        tl.step()
      }
      const added = tl.S.tickets.filter((t) => ['social', 'dark', 'pricing'].includes(t.key)).length
      expect(added).toBe(option === 'accept' ? 3 : 1)
      report.push(`scope    ${option.padEnd(9)}: ${tl.S.outcome.grade} ${tl.S.outcome.score}`)
    }
  })

  it('Free play builds a sensible plan from a brief', () => {
    const tl = runScenario('free', { brief: 'An online store called "Mitti Pottery" selling handmade ceramics' })
    const S = tl.S
    expect(S.scenario.client).toBe('Mitti Pottery')
    expect(S.tickets.some((t) => t.key === 'cart')).toBe(true)
    expect(S.outcome).toBeTruthy()
    report.push(`free     Mitti Pottery: ${S.outcome.grade} ${S.outcome.score}`)
    console.log(`\n── Balance report ──\n${report.join('\n')}\n`)
  })
})
