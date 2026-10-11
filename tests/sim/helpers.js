import { Timeline } from '../../src/sim/index.js'

/** Run a scenario headless until it ends (auto-picking default decisions). */
export function runScenario(id, { seed = 1, brief = '', maxTicks = 200000, onTick } = {}) {
  const tl = new Timeline(id, { seed, brief })
  while (!tl.S.outcome && tl.S.tick < maxTicks) {
    const S = tl.S
    if (S.decision) tl.push({ type: 'decide', id: S.decision.id, option: S.decisions[S.decision.id].default })
    onTick?.(tl)
    tl.step()
  }
  return tl
}
