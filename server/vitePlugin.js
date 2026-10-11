// Serves /api/agent from the Vite dev server (and `vite preview`), reading the key
// from .env.local — so live AI works locally with no extra process.

import { loadEnv } from 'vite'
import { handleAgent } from './agent.js'

const MAX_BODY = 32 * 1024

function readJson(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > MAX_BODY) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

export function agentApi() {
  let env = {}
  const middleware = async (req, res, next) => {
    if (!req.url.startsWith('/api/agent')) return next()
    const body = req.method === 'POST' ? await readJson(req) : null
    const out = await handleAgent({ method: req.method, body, ip: req.socket.remoteAddress }, { env })
    res.statusCode = out.status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(out.json))
  }
  return {
    name: 'agenthq-agent-api',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env }
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
