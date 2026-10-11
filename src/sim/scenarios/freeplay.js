import { at } from '../clock.js'
import { sanitizePlan } from './aiPlan.js'

// Free play: turn a typed brief into a ticket plan. With live AI the product manager's
// plan (written by Claude, passed in as `plan`) is used; otherwise keyword templates.

const CORE = [
  ['brief', 'Product brief & goals', 'product', 60, [], 3],
  ['flows', 'User flows & sitemap', 'product', 70, ['brief'], 3],
  ['wire', 'Wireframes', 'design', 120, ['flows'], 3],
  ['ds', 'Visual design system', 'design', 150, ['brief'], 2],
  ['mock', 'Key screen mockups', 'design', 150, ['wire', 'ds'], 3],
  ['ci', 'Repo + CI/CD pipeline', 'ops', 90, [], 2],
  ['shell', 'App scaffold & routing', 'frontend', 90, ['ci'], 2],
]

const MODULES = [
  { match: /landing|website|site|page|brand|portfolio/, tickets: [
    ['copy', 'Marketing copy', 'product', 90, ['brief'], 2],
    ['hero', 'Hero & feature sections', 'frontend', 180, ['mock', 'shell', 'copy'], 3],
    ['polish', 'Responsive polish & motion', 'frontend', 120, ['hero'], 1],
  ] },
  { match: /shop|store|commerce|sell|order|cart|marketplace/, tickets: [
    ['catalog', 'Product catalogue API', 'backend', 180, ['flows'], 3],
    ['pay', 'Payments integration', 'backend', 150, ['catalog'], 2],
    ['cart', 'Cart & checkout UI', 'frontend', 180, ['mock', 'catalog'], 3],
  ] },
  { match: /app|platform|saas|booking|portal|tool|tracker|social|community/, tickets: [
    ['auth', 'Accounts & auth API', 'backend', 150, ['ci'], 3],
    ['core-api', 'Core data API', 'backend', 210, ['flows'], 3],
    ['core-ui', 'Core feature UI', 'frontend', 210, ['mock', 'shell', 'core-api'], 3],
    ['profile', 'Profile & settings UI', 'frontend', 120, ['mock', 'auth'], 1],
  ] },
  { match: /dashboard|analytics|metrics|report|admin|data/, tickets: [
    ['pipeline', 'Data pipeline', 'backend', 180, ['flows'], 3],
    ['metrics', 'Metrics API', 'backend', 120, ['pipeline'], 2],
    ['charts', 'Charts & dashboard UI', 'frontend', 210, ['mock', 'metrics'], 3],
  ] },
  { match: /\bai\b|chat|bot|assistant|copilot|gpt|llm|agent/, tickets: [
    ['llm', 'LLM service & prompts', 'backend', 210, ['flows'], 3],
    ['chat', 'Chat interface', 'frontend', 180, ['mock', 'shell', 'llm'], 3],
  ] },
  { match: /mobile|ios|android|phone/, tickets: [
    ['mobile', 'Mobile layouts & gestures', 'frontend', 150, ['mock'], 2],
    ['offline', 'Offline sync', 'backend', 150, ['flows'], 1],
  ] },
  { match: /game|play|quiz/, tickets: [
    ['loop', 'Core game loop', 'frontend', 210, ['shell', 'mock'], 3],
    ['art', 'Game art & sprites', 'design', 180, ['ds'], 2],
    ['scores', 'Leaderboard API', 'backend', 120, ['ci'], 1],
  ] },
  { match: /api|backend|service|integration/, tickets: [
    ['api-design', 'API design & schema', 'backend', 120, ['flows'], 3],
    ['endpoints', 'Endpoints & validation', 'backend', 210, ['api-design'], 3],
    ['docs', 'API docs page', 'frontend', 90, ['endpoints', 'shell'], 1],
  ] },
]

const PALETTES = [
  { accent: '#7c5cff', bg: '#100e1c', ink: '#f2efff' },
  { accent: '#2fb7ff', bg: '#0b1620', ink: '#eaf6ff' },
  { accent: '#ff8a3d', bg: '#1d120b', ink: '#fff3ea' },
  { accent: '#36d399', bg: '#0c1914', ink: '#eafff5' },
]

export function brandFrom(brief) {
  const quoted = brief.match(/["“']([^"”']{2,32})["”']/)
  if (quoted) return quoted[1].trim()
  const named = brief.match(/(?:for|called|named)\s+(?:a\s+|an\s+|the\s+)?([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,2})/)
  return named ? named[1].trim() : 'Project Nova'
}

function templateTickets(brief) {
  const text = brief.toLowerCase()
  let modules = MODULES.filter((m) => m.match.test(text))
  if (!modules.length) modules = [MODULES[0], MODULES[2]]
  const tickets = [...CORE]
  for (const m of modules.slice(0, 3)) for (const t of m.tickets) if (!tickets.some((x) => x[0] === t[0])) tickets.push(t)
  const keys = new Set(tickets.map((t) => t[0]))
  return tickets.map(([k, title, type, effort, deps, pri]) => [k, title, type, effort, deps.filter((d) => keys.has(d)), pri])
}

export function buildFreeplay(brief = '', plan = null) {
  const ai = sanitizePlan(plan)
  const cleaned = ai ? ai.tickets : templateTickets(brief)
  cleaned.push(['launch', 'Deploy to production', 'ops', 30, ['*'], 3, { launch: true }])
  const total = cleaned.reduce((s, t) => s + t[3], 0)
  const name = ai?.site.name || brandFrom(brief)
  const palette = PALETTES[name.length % PALETTES.length]
  const aiSite = ai ? Object.fromEntries(Object.entries(ai.site).filter(([, v]) => (Array.isArray(v) ? v.length : v))) : {}
  return {
    id: 'free',
    title: 'Free Play',
    client: name,
    difficulty: 'Custom',
    brief: brief || 'Build something great.',
    blurb: 'Your brief, your company.',
    start: at(1, 9, 0),
    deadline: total > 2300 ? at(3, 17, 0) : at(2, 17, 0),
    budget: total > 2300 ? 32000 : 22000,
    kickoff: true,
    scoring: 'delivery',
    aiPlanned: !!ai,
    site: { name, tagline: brief.slice(0, 60) || 'Built by AgentHQ.', nav: ['Product', 'Pricing', 'Start'], ...palette, ...aiSite },
    tickets: cleaned,
  }
}
