// Serverless entry for hosting (Vercel-style `api/` function). Set ANTHROPIC_API_KEY
// in the host's environment variables. Same handler as the dev server.

import { handleAgent } from '../server/agent.js'

export default async function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
  const out = await handleAgent({ method: req.method, body, ip }, { env: process.env })
  res.status(out.status).setHeader('content-type', 'application/json')
  res.send(JSON.stringify(out.json))
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
