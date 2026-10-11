// Validates a project plan written by the AI product manager (Phase 6) before the
// simulation trusts it. Whatever the model returns, the result is always a playable,
// acyclic ticket list and a renderable site — or null, and free play falls back to
// keyword templates.

export const TICKET_TYPES = ['product', 'design', 'frontend', 'backend', 'ops']
const MIN_TICKETS = 6
const MAX_TICKETS = 22
const HEX = /^#[0-9a-f]{6}$/i

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo))
const slug = (v) => text(v, 24).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')

/** @returns {{ tickets: any[], site: object } | null} */
export function sanitizePlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.tickets)) return null
  const tickets = []
  const keys = new Set()
  for (const raw of plan.tickets.slice(0, MAX_TICKETS)) {
    if (!raw || typeof raw !== 'object') continue
    const title = text(raw.title, 48)
    const type = TICKET_TYPES.includes(raw.type) ? raw.type : null
    let key = slug(raw.key) || slug(title)
    if (!title || !type || !key || key === 'launch') continue
    while (keys.has(key)) key += '-2'
    // Dependencies may only point backwards, so the graph can never contain a cycle.
    const deps = (Array.isArray(raw.deps) ? raw.deps : []).map(slug).filter((d) => keys.has(d)).slice(0, 4)
    tickets.push([key, title, type, Math.round(clamp(raw.effort, 30, 240) / 10) * 10, [...new Set(deps)], Math.round(clamp(raw.priority, 1, 3))])
    keys.add(key)
  }
  if (tickets.length < MIN_TICKETS) return null

  const s = plan.site && typeof plan.site === 'object' ? plan.site : {}
  const site = {
    name: text(s.name, 28),
    tagline: text(s.tagline, 70),
    cta: text(s.cta, 18),
    nav: (Array.isArray(s.nav) ? s.nav : []).map((n) => text(n, 12)).filter(Boolean).slice(0, 3),
    features: (Array.isArray(s.features) ? s.features : []).map((f) => text(f, 30)).filter(Boolean).slice(0, 3),
  }
  for (const k of ['accent', 'bg', 'ink']) if (HEX.test(s[k] || '')) site[k] = s[k]
  return { tickets, site }
}
