import { describe, it, expect } from 'vitest'
import { Timeline } from '../../src/sim/index.js'
import { sanitizePlan } from '../../src/sim/scenarios/aiPlan.js'
import { handleAgent } from '../../server/agent.js'
import { chatCommands } from '../../src/ai/AgentAI.js'

const ticket = (key, type, deps = [], effort = 120) => ({ key, title: `Do ${key}`, type, effort, deps, priority: 2 })
const GOOD_PLAN = {
  tickets: [
    ticket('brief', 'product'), ticket('ci', 'ops'), ticket('wire', 'design', ['brief']), ticket('ui-kit', 'design', ['brief']),
    ticket('api', 'backend', ['brief']), ticket('shell', 'frontend', ['ci']), ticket('pages', 'frontend', ['wire', 'shell', 'api']),
    ticket('polish', 'frontend', ['pages']),
  ],
  site: { name: 'Mitti', tagline: 'Handmade pottery, delivered', cta: 'Shop now', nav: ['Shop', 'Story'], features: ['Small batch', 'Free returns', 'Gift wrap'], accent: '#e07a3f', bg: '#1a120c', ink: '#fff4ea' },
}

describe('AI plan validation', () => {
  it('keeps a good plan and drops forward/unknown dependencies', () => {
    const p = sanitizePlan({ ...GOOD_PLAN, tickets: [ticket('a', 'product', ['b']), ...GOOD_PLAN.tickets.slice(1), ticket('b', 'backend', ['nope'])] })
    expect(p.tickets.length).toBe(9)
    expect(p.tickets[0][4]).toEqual([]) // 'a' may not depend on later 'b'
    expect(p.tickets.at(-1)[4]).toEqual([])
    expect(p.site.name).toBe('Mitti')
  })

  it('rejects junk', () => {
    expect(sanitizePlan(null)).toBeNull()
    expect(sanitizePlan({ tickets: [ticket('x', 'magic')] })).toBeNull()
    expect(sanitizePlan({ tickets: 'lol' })).toBeNull()
  })

  it('clamps effort, strips bad colours, dedupes keys', () => {
    const p = sanitizePlan({ ...GOOD_PLAN, tickets: [...GOOD_PLAN.tickets, ticket('brief', 'product', [], 9999)], site: { ...GOOD_PLAN.site, accent: 'red; background:url(x)' } })
    expect(p.tickets.at(-1)[0]).toBe('brief-2')
    expect(p.tickets.at(-1)[3]).toBe(240)
    expect(p.site.accent).toBeUndefined()
  })

  it('free play uses the AI plan, adds the launch ticket, and stays deterministic', () => {
    const run = () => {
      const tl = new Timeline('free', { seed: 4, brief: 'pottery shop', plan: GOOD_PLAN })
      while (tl.S.tick < 3000) tl.step()
      return tl.S
    }
    const S = run()
    expect(S.scenario.aiPlanned).toBe(true)
    expect(S.scenario.site.features).toEqual(GOOD_PLAN.site.features)
    expect(S.tickets.length).toBe(GOOD_PLAN.tickets.length + 1)
    expect(S.tickets.at(-1).launch).toBe(true)
    expect(JSON.stringify(run())).toBe(JSON.stringify(S))
  })
})

describe('talking to agents', () => {
  it('voice + action commands replay identically after a seek', () => {
    const tl = new Timeline('mvp', { seed: 2 })
    while (tl.S.tick < 2500) tl.step()
    for (const c of chatCommands('rohan', 'take a break', { reply: 'Back in ten!', thought: 'Coffee time', action: { type: 'break' } })) tl.push(c)
    while (tl.S.tick < 4000) tl.step()
    const live = JSON.stringify(tl.S.agents)
    const rohan = tl.S.agents.find((a) => a.id === 'rohan')
    expect(rohan.memory.some((m) => m.text.includes('Back in ten!'))).toBe(true)
    tl.seek(0)
    tl.seek(4000)
    expect(JSON.stringify(tl.S.agents)).toBe(live)
  })

  it('the action runs before the reply, so the reply is what they say', () => {
    const cmds = chatCommands('rohan', 'do #105', { reply: 'Sure!', thought: 'ok', action: { type: 'assign', ticket: '105' } })
    expect(cmds.map((c) => c.type)).toEqual(['assign', 'voice'])
    expect(cmds[0].ticket).toBe('#105')
  })
})

describe('Claude proxy', () => {
  const fakeFetch = (input) => async (url, init) => {
    fakeFetch.last = JSON.parse(init.body)
    return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: fakeFetch.last.tool_choice.name, input }] }) }
  }

  it('reports offline without a key and refuses POSTs', async () => {
    expect((await handleAgent({ method: 'GET' }, { env: {} })).json.live).toBe(false)
    expect((await handleAgent({ method: 'POST', body: { task: 'plan', brief: 'x' } }, { env: {} })).status).toBe(503)
  })

  it('forces structured tool output and returns it', async () => {
    const out = await handleAgent({ method: 'POST', body: { task: 'plan', brief: 'A pottery shop' }, ip: 't1' }, { env: { ANTHROPIC_API_KEY: 'k' }, fetch: fakeFetch(GOOD_PLAN) })
    expect(out.status).toBe(200)
    expect(out.json.result.site.name).toBe('Mitti')
    expect(fakeFetch.last.tool_choice).toEqual({ type: 'tool', name: 'submit_plan' })
  })

  it('caps untrusted input lengths in the prompt', async () => {
    await handleAgent(
      { method: 'POST', body: { task: 'chat', message: 'x'.repeat(5000), agent: { name: 'Rohan', trait: 'y'.repeat(5000) } }, ip: 't2' },
      { env: { ANTHROPIC_API_KEY: 'k' }, fetch: fakeFetch({ reply: 'hi', thought: '', action: { type: 'none' } }) },
    )
    expect(fakeFetch.last.messages[0].content.length).toBe(280)
    expect(fakeFetch.last.system.length).toBeLessThan(1500)
  })

  it('rejects unknown tasks', async () => {
    const out = await handleAgent({ method: 'POST', body: { task: 'write my essay' }, ip: 't3' }, { env: { ANTHROPIC_API_KEY: 'k' }, fetch: fakeFetch({}) })
    expect(out.status).toBe(400)
  })
})
