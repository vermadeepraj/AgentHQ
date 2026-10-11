// The Claude proxy (Phase 6). Runs server-side only — as Vite dev middleware
// (server/vitePlugin.js) or as a serverless function (api/agent.js) — so the API key
// never reaches the browser. Prompts are built here from small, length-capped,
// structured inputs: the endpoint can't be used as a general-purpose chatbot.

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_PLAN_MODEL = 'claude-sonnet-5-5'
const DEFAULT_CHAT_MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 30000

const TYPES = ['product', 'design', 'frontend', 'backend', 'ops']
const ACTIONS = ['none', 'assign', 'break', 'sendHome']

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 100) / 100 : 0)

// ── Tools (structured output) ─────────────────────────────────────────────
const PLAN_TOOL = {
  name: 'submit_plan',
  description: 'Submit the project plan: tickets for the team and the copy for the launched website.',
  input_schema: {
    type: 'object',
    required: ['tickets', 'site'],
    properties: {
      tickets: {
        type: 'array',
        minItems: 8,
        maxItems: 18,
        items: {
          type: 'object',
          required: ['key', 'title', 'type', 'effort', 'deps', 'priority'],
          properties: {
            key: { type: 'string', description: 'short kebab-case id, unique' },
            title: { type: 'string', description: '2–5 words, like a real Jira ticket' },
            type: { type: 'string', enum: TYPES },
            effort: { type: 'integer', minimum: 30, maximum: 240, description: 'work minutes for one skilled person' },
            deps: { type: 'array', items: { type: 'string' }, description: 'keys of EARLIER tickets this needs' },
            priority: { type: 'integer', minimum: 1, maximum: 3 },
          },
        },
      },
      site: {
        type: 'object',
        required: ['name', 'tagline', 'cta', 'nav', 'features', 'accent', 'bg', 'ink'],
        properties: {
          name: { type: 'string', description: 'product/brand name, max 24 chars' },
          tagline: { type: 'string', description: 'hero headline, max 60 chars' },
          cta: { type: 'string', description: 'button label, max 16 chars' },
          nav: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          features: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'three feature names, max 26 chars each' },
          accent: { type: 'string', description: 'hex colour #rrggbb' },
          bg: { type: 'string', description: 'dark hex background #rrggbb' },
          ink: { type: 'string', description: 'light hex text colour #rrggbb' },
        },
      },
    },
  },
}

const CHAT_TOOL = {
  name: 'respond',
  description: 'Reply to the CEO in character, and optionally act on what they asked.',
  input_schema: {
    type: 'object',
    required: ['reply', 'thought', 'action'],
    properties: {
      reply: { type: 'string', description: 'what you say out loud — one or two short sentences, max 140 chars' },
      thought: { type: 'string', description: 'your private one-line thought, max 80 chars' },
      action: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ACTIONS, description: 'assign = start a ticket; break = coffee/rest; sendHome = leave for the day' },
          ticket: { type: 'string', description: 'ticket id like #105 (only for assign)' },
        },
      },
    },
  },
}

// ── Prompts ───────────────────────────────────────────────────────────────
function planRequest(body) {
  const brief = text(body.brief, 300)
  if (!brief) throw new HttpError(400, 'brief is required')
  return {
    tool: PLAN_TOOL,
    model: 'plan',
    maxTokens: 2000,
    system:
      'You are Priya, the product manager at a small software studio. You turn a client brief into a lean, ' +
      'realistic two-day sprint plan for this team: 2 product people, 2 designers, 4 engineers (frontend & backend), ' +
      '1 QA engineer, 1 DevOps engineer. Start with product discovery, then design and infrastructure in parallel, ' +
      'then implementation. Include at least one ops ticket (CI/CD or hosting) early. Do NOT add a deploy/launch ' +
      'ticket — it is added automatically. Total effort should land between 1600 and 2400 minutes. Dependencies ' +
      'must only reference keys of tickets listed earlier. Also write the copy for the shipped website.',
    messages: [{ role: 'user', content: `Client brief: ${brief}` }],
  }
}

function chatRequest(body) {
  const message = text(body.message, 280)
  const a = body.agent || {}
  if (!message || !a.name) throw new HttpError(400, 'agent and message are required')
  const skills = Object.entries(a.skills || {}).map(([k, v]) => `${text(k, 12)} ${Math.round(num(v) * 100)}`).join(', ')
  const memory = (Array.isArray(a.memory) ? a.memory : []).slice(-8).map((m) => `- ${text(m, 120)}`).join('\n')
  const tickets = (Array.isArray(body.tickets) ? body.tickets : []).slice(0, 30)
    .map((t) => `${text(t.id, 6)} ${text(t.title, 48)} [${text(t.type, 10)}, ${text(t.status, 8)}${t.assignee ? `, ${text(t.assignee, 16)}` : ''}${t.blocked ? ', blocked' : ''}]`)
    .join('\n')
  const system =
    `You are ${text(a.name, 40)}, ${text(a.role, 40)} at AgentHQ, a small software studio in a simulated office. ` +
    `Personality: ${text(a.trait, 80)}. Skills (0–100): ${skills}. ` +
    `Right now: ${text(a.status, 60)}; thinking "${text(a.thought, 90)}". ` +
    `Energy ${Math.round(num(a.energy) * 100)}%, morale ${Math.round(num(a.morale) * 100)}%. ` +
    `Time: ${text(body.clock, 24)}. Project: ${text(body.project, 80)}.\n` +
    `Recent memory:\n${memory || '- nothing yet'}\n\nSprint board:\n${tickets || '(no tickets yet)'}\n\n` +
    'The CEO is talking to you. Stay in character: warm, brief, specific to the work, a little personality. ' +
    'If they ask you to work on something, pick the matching ticket id from the board (only to-do or in-progress ' +
    "tickets you have skill for) and use action assign. If they tell you to rest or take a break, use break; to go " +
    "home, use sendHome. Otherwise action none. Never invent tickets. If asked something off-topic, answer briefly in character and steer back to the work."
  return { tool: CHAT_TOOL, model: 'chat', maxTokens: 300, system, messages: [{ role: 'user', content: message }] }
}

// ── Plumbing ──────────────────────────────────────────────────────────────
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const buckets = new Map()
/** Tiny in-memory rate limit per client: `limit` requests per `windowMs`. */
function allow(ip, limit = 40, windowMs = 10 * 60 * 1000) {
  const now = Date.now()
  const b = buckets.get(ip) || { start: now, n: 0 }
  if (now - b.start > windowMs) {
    b.start = now
    b.n = 0
  }
  b.n++
  buckets.set(ip, b)
  return b.n <= limit
}

async function callClaude(req, env, fetchImpl) {
  const model = req.model === 'plan' ? env.AGENTHQ_PLAN_MODEL || DEFAULT_PLAN_MODEL : env.AGENTHQ_CHAT_MODEL || DEFAULT_CHAT_MODEL
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages,
        tools: [req.tool],
        tool_choice: { type: 'tool', name: req.tool.name },
      }),
    })
    if (!res.ok) throw new HttpError(502, `Claude API error ${res.status}`)
    const data = await res.json()
    const block = (data.content || []).find((b) => b.type === 'tool_use' && b.name === req.tool.name)
    if (!block) throw new HttpError(502, 'Claude returned no structured answer')
    return { model, result: block.input }
  } catch (e) {
    if (e.name === 'AbortError') throw new HttpError(504, 'Claude took too long')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Handle one /api/agent request.
 * @param {{ method: string, body: any, ip: string }} req
 * @param {{ env: Record<string,string|undefined>, fetch?: typeof fetch }} ctx
 * @returns {Promise<{ status: number, json: any }>}
 */
export async function handleAgent({ method, body, ip }, { env, fetch: fetchImpl = fetch }) {
  const live = !!env.ANTHROPIC_API_KEY
  try {
    if (method === 'GET') return { status: 200, json: { live, models: live ? { plan: env.AGENTHQ_PLAN_MODEL || DEFAULT_PLAN_MODEL, chat: env.AGENTHQ_CHAT_MODEL || DEFAULT_CHAT_MODEL } : null } }
    if (method !== 'POST') throw new HttpError(405, 'Method not allowed')
    if (!live) throw new HttpError(503, 'Live AI is not configured (set ANTHROPIC_API_KEY)')
    if (!allow(ip || 'local')) throw new HttpError(429, 'Slow down — too many AI requests')
    const task = body?.task
    const req = task === 'plan' ? planRequest(body) : task === 'chat' ? chatRequest(body) : null
    if (!req) throw new HttpError(400, 'Unknown task')
    const { model, result } = await callClaude(req, env, fetchImpl)
    return { status: 200, json: { ok: true, model, result } }
  } catch (e) {
    return { status: e.status || 500, json: { ok: false, error: e.status ? e.message : 'Internal error' } }
  }
}
