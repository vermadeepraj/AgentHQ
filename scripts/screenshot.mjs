// Screenshots of the running dev server for visual checks.
// Usage: node scripts/screenshot.mjs [url-query] [name] [waitMs] [extra JS to eval before shot]
// Env: VIEWPORT=390x844 for a phone-sized touch viewport.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const query = process.argv[2] ?? ''
const name = process.argv[3] ?? 'shot'
const wait = Number(process.argv[4] ?? 6000)
const script = process.argv[5] ?? ''
const base = process.env.URL ?? 'http://localhost:5173/'
mkdirSync('scripts/out', { recursive: true })

const browser = await chromium.launch({
  channel: process.env.BROWSER ?? 'msedge',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
})
const [vw, vh] = (process.env.VIEWPORT ?? '1600x900').split('x').map(Number)
const phone = vw < 700
const page = await browser.newPage({ viewport: { width: vw, height: vh }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(base + query, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(wait)
if (script) await page.evaluate(script)
if (script) await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const a = window.__agenthq
  return a ? { fps: a.fps.value, calls: a.stage.renderer.info.render.calls, tris: a.stage.renderer.info.render.triangles, tick: a.frame?.tick, clock: a.state?.clock } : null
})
await page.screenshot({ path: `scripts/out/${name}.png` })
console.log(JSON.stringify(info))
console.log(logs.filter((l) => !l.includes('[vite]')).slice(0, 30).join('\n'))
await browser.close()
