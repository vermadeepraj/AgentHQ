// End-to-end check of the live-AI path without an API key: /api/agent is mocked with
// Claude-shaped answers. Needs `npm run dev`. Plays a free-play run to launch and saves
// scripts/out/p6-live-*.png (start screen, chat, the AI-written site on the lobby screen).
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const plan = {
  tickets: [
    { key: 'brief', title: 'Brand & customer research', type: 'product', effort: 60, deps: [], priority: 3 },
    { key: 'ci', title: 'Hosting & CI pipeline', type: 'ops', effort: 60, deps: [], priority: 2 },
    { key: 'flows', title: 'Shop flows & sitemap', type: 'product', effort: 60, deps: ['brief'], priority: 3 },
    { key: 'look', title: 'Earthy visual identity', type: 'design', effort: 90, deps: ['brief'], priority: 2 },
    { key: 'mock', title: 'Product page mockups', type: 'design', effort: 90, deps: ['flows', 'look'], priority: 3 },
    { key: 'catalog', title: 'Catalogue & inventory API', type: 'backend', effort: 90, deps: ['flows'], priority: 3 },
    { key: 'shell', title: 'Storefront scaffold', type: 'frontend', effort: 60, deps: ['ci'], priority: 2 },
    { key: 'pdp', title: 'Product & cart pages', type: 'frontend', effort: 90, deps: ['mock', 'shell', 'catalog'], priority: 3 },
  ],
  site: { name: 'Mitti', tagline: 'Pottery made slowly, by hand, for you', cta: 'Shop the kiln', nav: ['Shop', 'Makers', 'Story'], features: ['Small-batch glazes', 'Packed with care', 'Meet the potters'], accent: '#e0874f', bg: '#1b130e', ink: '#fff3e8' },
}
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const logs = []
page.on('pageerror', (e) => logs.push(e.message))
const seen = []
await page.route('**/api/agent', async (route) => {
  const req = route.request()
  if (req.method() === 'GET') return route.fulfill({ json: { live: true, models: { plan: 'mock', chat: 'mock' } } })
  const body = req.postDataJSON()
  seen.push(body.task)
  if (body.task === 'plan') return route.fulfill({ json: { ok: true, model: 'mock', result: plan } })
  const t = body.tickets.find((x) => x.status === 'todo' && !x.blocked && x.type === 'frontend') || body.tickets.find((x) => x.status === 'todo')
  return route.fulfill({ json: { ok: true, model: 'mock', result: { reply: `Happy to — I'll grab ${t.id} now.`, thought: `CEO wants ${t.title}`, action: { type: 'assign', ticket: t.id } } } })
})
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
await page.screenshot({ path: 'scripts/out/p6-live-start.png' })
await page.fill('input[name=brief]', 'An online store called "Mitti" for handmade pottery')
await page.click('.go')
await page.waitForTimeout(6000)
await page.evaluate(() => { const a = window.__agenthq; a.ui.parts.coach.store.off = true; a.sim.setSpeed(8) })
await page.waitForFunction(() => window.__agenthq.state?.tickets.some((t) => t.status === 'todo'), null, { timeout: 120000 })
const info1 = await page.evaluate(() => { const S = window.__agenthq.state; return { client: S.scenario.client, ai: S.scenario.aiPlanned, tickets: S.tickets.map((t) => t.title) } })
await page.evaluate(() => { const a = window.__agenthq; a.sim.setSpeed(1); a.select('sara') })
await page.waitForTimeout(500)
await page.fill('.chat input', 'Could you pick up the next frontend ticket?')
await page.press('.chat input', 'Enter')
await page.waitForTimeout(2500)
await page.screenshot({ path: 'scripts/out/p6-live-chat.png' })
const info2 = await page.evaluate(() => { const S = window.__agenthq.state; const s = S.agents.find((a) => a.id === 'sara'); return { say: s.say, thought: s.thought, ticket: S.tickets.find((t) => t.assignee === 'sara')?.title, status: document.querySelector('.chat-status').textContent } })
// Jump to the launch to see the AI-written site on the lobby screen.
await page.evaluate(() => { const a = window.__agenthq; a.select(null); a.sim.setSpeed(8) })
await page.waitForFunction(() => window.__agenthq.state?.launchedAt != null || window.__agenthq.state?.outcome, null, { timeout: 300000, polling: 2000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { const a = window.__agenthq; a.ui.setModal(null); a.sim.pause(true); a.stage.rig.focus(13, 7.5, 9) })
await page.waitForTimeout(3000)
const url = await page.evaluate(() => window.__agenthq.office.boards.lobby.canvas.toDataURL('image/png'))
fs.writeFileSync('scripts/out/p6-live-site.png', Buffer.from(url.split(',')[1], 'base64'))
console.log(JSON.stringify({ seen, info1, info2, outcome: await page.evaluate(() => window.__agenthq.state.outcome?.grade), errors: logs }, null, 1))
await browser.close()
