// Small DOM helpers shared by UI components.

import { TEAMS } from '../sim/index.js'

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v)
  }
  if (html) node.innerHTML = html
  return node
}

/** Set innerHTML only when it changed (keeps hover/focus stable at 20 Hz). */
export function patch(node, html) {
  if (node._html !== html) {
    node._html = html
    node.innerHTML = html
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const money = (v) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`
export const pct = (v) => `${Math.round(v * 100)}%`
export const teamColor = (team) => TEAMS[team]?.color || '#ffffff'
export const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2)

export function avatar(agent, size = 34) {
  return `<span class="avatar" style="--c:${teamColor(agent.team)};--s:${size}px">${esc(initials(agent.name))}</span>`
}

export const ACT_LABEL = {
  walk: 'Walking', sit: 'Sitting', type: 'Working at desk', eat: 'Eating', lounge: 'Relaxing',
  talk: 'Talking', drink: 'Grabbing a drink', present: 'Presenting', celebrate: 'Celebrating',
  frustrated: 'Frustrated', pingpong: 'Playing ping-pong', tinker: 'Working in the server room', stand: 'Standing',
}

export function statusOf(a) {
  if (!a.present) return a.paged ? 'On the way (paged)' : a.burnout ? 'Home — burned out' : 'Off duty'
  if (a.hidden) return 'Out for lunch'
  return ACT_LABEL[a.act] || a.act
}
