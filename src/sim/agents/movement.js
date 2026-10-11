// Walking: follow A* waypoints at a fixed speed, sidestepping to the right when
// another walker is ahead. Pure path-following never needs a walkability check
// (waypoints have line of sight); only the avoidance nudge is validated.

import { WALK_PER_TICK } from '../constants.js'
import { findPath, walkable } from '../world/nav.js'

const AVOID_RADIUS = 0.9

/** Advance `a` along its path to `step`. Returns true on arrival. */
export function moveTo(S, a, step) {
  if (!a.path) {
    a.path = findPath({ x: a.x, z: a.z }, { x: step.x, z: step.z })
    a.pathI = 0
  }
  a.act = 'walk'
  a.carry = step.carry || null
  let budget = WALK_PER_TICK
  const path = a.path
  while (budget > 1e-6 && a.pathI < path.length) {
    const wp = path[a.pathI]
    const dx = wp.x - a.x
    const dz = wp.z - a.z
    const d = Math.hypot(dx, dz)
    if (d <= budget) {
      a.x = wp.x
      a.z = wp.z
      budget -= d
      a.pathI++
      continue
    }
    const ux = dx / d
    const uz = dz / d
    let px = 0
    let pz = 0
    for (const o of S.agents) {
      if (o === a || !o.present || o.hidden || o.act !== 'walk') continue
      const ox = o.x - a.x
      const oz = o.z - a.z
      const od = Math.hypot(ox, oz)
      if (od > AVOID_RADIUS || od < 1e-4 || ox * ux + oz * uz <= 0) continue
      const w = (AVOID_RADIUS - od) / AVOID_RADIUS
      px += -uz * w // right-hand perpendicular
      pz += ux * w
    }
    let mx = ux
    let mz = uz
    if (px || pz) {
      mx = ux + px * 0.9
      mz = uz + pz * 0.9
      const ml = Math.hypot(mx, mz)
      mx /= ml
      mz /= ml
      if (!walkable(a.x + mx * budget, a.z + mz * budget)) (mx = ux), (mz = uz)
    }
    a.x += mx * budget
    a.z += mz * budget
    a.yaw = Math.atan2(mx, mz)
    budget = 0
  }
  if (a.pathI >= path.length) {
    a.path = null
    if (step.yaw != null) a.yaw = step.yaw
    return true
  }
  return false
}
