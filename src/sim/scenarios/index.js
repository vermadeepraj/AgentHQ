import mvp from './mvp.js'
import outage from './outage.js'
import scope from './scopeCreep.js'
import crunch from './crunch.js'
import { buildFreeplay } from './freeplay.js'

export const SCENARIOS = { mvp, outage, scope, crunch }
export const SCENARIO_LIST = [mvp, outage, scope, crunch]

export function getScenario(id, { brief, plan } = {}) {
  if (id === 'free') return buildFreeplay(brief, plan)
  const sc = SCENARIOS[id]
  if (!sc) throw new Error(`Unknown scenario "${id}"`)
  return sc
}
