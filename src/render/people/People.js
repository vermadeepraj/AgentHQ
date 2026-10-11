// Characters. Every body part is ONE InstancedMesh shared by all agents, so
// 16 animated people cost ~20 draw calls. Joint transforms are solved in JS
// each frame from procedural poses (poses.js) and written as instance matrices.

import * as THREE from 'three'
import { layout, SKIN, HAIR } from '../../sim/index.js'
import { GeoBuilder } from '../office/builder.js'
import { JOINTS, targetPose, restPose } from './poses.js'

const CAPACITY = 20
const FRAME_MS = 50
const HAIR_STYLES = ['short', 'buzz', 'long', 'bun', 'curly', 'bob', 'ponytail']

const capsule = (r, len, color, pos = {}) => new GeoBuilder().add(new THREE.CapsuleGeometry(r, len, 4, 10), color, pos).build()

function hairGeometry(style) {
  const b = new GeoBuilder()
  const cap = (r = 0.123, sy = 0.78) => b.sphere(r, '#ffffff', 0, 0.035, -0.008, { sy }, 2)
  if (style === 'buzz') cap(0.119, 0.7)
  else if (style === 'curly') b.sphere(0.145, '#ffffff', 0, 0.04, -0.01, { sy: 0.82 }, 1)
  else cap()
  if (style === 'long') b.box(0.23, 0.3, 0.08, '#ffffff', 0, -0.24, -0.075)
  if (style === 'bun') b.sphere(0.06, '#ffffff', 0, 0.11, -0.09, {}, 1)
  if (style === 'bob') b.box(0.265, 0.17, 0.22, '#ffffff', 0, -0.12, -0.025)
  if (style === 'ponytail') b.add(new THREE.CapsuleGeometry(0.035, 0.16, 3, 8), '#ffffff', { x: 0, y: -0.06, z: -0.14, rx: 0.45 })
  return b.build()
}

const ITEM_GEOMETRY = {
  cup: () => new GeoBuilder().cyl(0.04, 0.035, 0.1, '#f5f2ea', 0, -0.05, 0, 12).build(),
  doc: () => new GeoBuilder().box(0.22, 0.3, 0.012, '#eaf6ff', 0, -0.15, 0).build(),
  pizza: () => new GeoBuilder().box(0.16, 0.02, 0.2, '#e2a54a', 0, 0, 0.06).build(),
  food: () => new GeoBuilder().cyl(0.09, 0.06, 0.06, '#d9d4cc', 0, -0.02, 0.05, 14).build(),
}

const _m = new THREE.Matrix4()
const _t = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _one = new THREE.Vector3(1, 1, 1)
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const _c = new THREE.Color()

const T = (x, y, z) => _t.makeTranslation(x, y, z)
const R = (rx, ry = 0, rz = 0) => _t.makeRotationFromEuler(_e.set(rx, ry, rz, 'YXZ'))

const SEAT_SPOTS = Object.values(layout.spots).filter((s) => ['desk', 'meet', 'stool', 'seat'].includes(s.kind))
function seatKind(x, z) {
  for (const s of SEAT_SPOTS) if (Math.abs(s.x - x) < 0.3 && Math.abs(s.z - z) < 0.3) return s.kind
  return null
}

const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t

export class People {
  constructor(scene) {
    this.scene = scene
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })
    this.parts = {}
    const part = (name, geometry, count = 1) => {
      const mesh = new THREE.InstancedMesh(geometry, this.material, CAPACITY * count)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, ZERO)
        mesh.setColorAt(i, _c.set('#ffffff'))
      }
      scene.add(mesh)
      this.parts[name] = mesh
    }
    part('head', new GeoBuilder().sphere(0.115, '#ffffff', 0, 0, 0, { sy: 1.1 }, 2).box(0.03, 0.04, 0.03, '#ffffff', 0, -0.03, 0.11).build())
    part('eye', new GeoBuilder().sphere(0.016, '#ffffff', 0, 0, 0, {}, 1).build(), 2)
    part('torso', capsule(0.16, 0.3, '#ffffff', { sz: 0.68 }))
    part('pelvis', new GeoBuilder().box(0.31, 0.16, 0.2, '#ffffff', 0, -0.08, 0).build())
    part('upperArm', capsule(0.05, 0.2, '#ffffff'), 2)
    part('foreArm', capsule(0.043, 0.18, '#ffffff'), 2)
    part('hand', new GeoBuilder().sphere(0.048, '#ffffff', 0, 0, 0, { sz: 0.7 }, 1).build(), 2)
    part('thigh', capsule(0.072, 0.3, '#ffffff'), 2)
    part('shin', capsule(0.058, 0.3, '#ffffff'), 2)
    part('shoe', new GeoBuilder().box(0.1, 0.07, 0.25, '#ffffff', 0, -0.035, 0.05).build(), 2)
    for (const style of HAIR_STYLES) part(`hair_${style}`, hairGeometry(style))
    this.items = {}
    for (const [k, make] of Object.entries(ITEM_GEOMETRY)) {
      const mesh = new THREE.InstancedMesh(make(), this.material, CAPACITY)
      mesh.castShadow = true
      mesh.frustumCulled = false
      for (let i = 0; i < CAPACITY; i++) mesh.setMatrixAt(i, ZERO)
      if (k === 'doc') mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.6, 1.7, 1.9) })
      scene.add(mesh)
      this.items[k] = mesh
    }
    this.slots = new Map() // agent id → render state
    this.headPositions = new Map()
    this.frameTime = 0
  }

  /** Feed a new simulation frame. */
  setAgents(agents, now) {
    this.frameTime = now
    const seen = new Set()
    for (const a of agents) {
      seen.add(a.id)
      let s = this.slots.get(a.id)
      if (!s) {
        s = this.createSlot(a)
        this.slots.set(a.id, s)
      }
      const jump = Math.hypot(a.x - s.cur.x, a.z - s.cur.z) > 3
      s.prev = jump ? { x: a.x, z: a.z } : { x: s.disp.x, z: s.disp.z }
      s.cur = { x: a.x, z: a.z }
      if (jump) s.disp = { x: a.x, z: a.z }
      s.agent = a
    }
    for (const [id, s] of this.slots) if (!seen.has(id)) this.hide(s)
  }

  createSlot(a) {
    const index = this.slots.size
    const look = a.look
    const s = {
      index, agent: a, prev: { x: a.x, z: a.z }, cur: { x: a.x, z: a.z }, disp: { x: a.x, z: a.z },
      yaw: a.yaw, phase: 0, pose: restPose(), seed: index * 1.7,
      hair: HAIR_STYLES.includes(look.hairStyle) ? look.hairStyle : 'short',
    }
    const set = (name, i, color) => this.parts[name].setColorAt(i, _c.set(color))
    const skin = SKIN[look.skin] || SKIN[1]
    set('head', index, skin)
    set('hand', index * 2, skin)
    set('hand', index * 2 + 1, skin)
    set('eye', index * 2, '#1a1410')
    set('eye', index * 2 + 1, '#1a1410')
    set('torso', index, look.shirt)
    set('upperArm', index * 2, look.shirt)
    set('upperArm', index * 2 + 1, look.shirt)
    set('foreArm', index * 2, look.shirt)
    set('foreArm', index * 2 + 1, look.shirt)
    set('pelvis', index, look.pants)
    for (const k of ['thigh', 'shin']) {
      set(k, index * 2, look.pants)
      set(k, index * 2 + 1, look.pants)
    }
    set('shoe', index * 2, look.shoes)
    set('shoe', index * 2 + 1, look.shoes)
    set(`hair_${s.hair}`, index, HAIR[look.hair] || HAIR[0])
    for (const mesh of Object.values(this.parts)) mesh.instanceColor.needsUpdate = true
    return s
  }

  hide(s) {
    const i = s.index
    for (const [name, mesh] of Object.entries(this.parts)) {
      const pair = mesh.count === CAPACITY * 2
      if (name.startsWith('hair_')) mesh.setMatrixAt(i, ZERO)
      else if (pair) {
        mesh.setMatrixAt(i * 2, ZERO)
        mesh.setMatrixAt(i * 2 + 1, ZERO)
      } else mesh.setMatrixAt(i, ZERO)
    }
    for (const mesh of Object.values(this.items)) mesh.setMatrixAt(i, ZERO)
    this.headPositions.delete(s.agent.id)
  }

  update(dt, time, now) {
    const alpha = Math.min(1, (now - this.frameTime) / FRAME_MS)
    const k = 1 - Math.exp(-14 * dt)
    for (const s of this.slots.values()) {
      const a = s.agent
      if (!a.present || a.hidden) {
        this.hide(s)
        continue
      }
      const nx = s.prev.x + (s.cur.x - s.prev.x) * alpha
      const nz = s.prev.z + (s.cur.z - s.prev.z) * alpha
      const moved = Math.hypot(nx - s.disp.x, nz - s.disp.z)
      s.disp.x = nx
      s.disp.z = nz
      s.phase += (moved / 1.3) * Math.PI * 2
      s.yaw = lerpAngle(s.yaw, a.yaw, 1 - Math.exp(-10 * dt))
      const target = targetPose(a.act, time, s.phase, { seat: seatKind(a.x, a.z), carry: a.carry, seed: s.seed })
      const kk = a.act === 'walk' ? 1 - Math.exp(-22 * dt) : k
      for (const j of JOINTS) s.pose[j] += (target[j] - s.pose[j]) * kk
      this.solve(s)
    }
    for (const mesh of Object.values(this.parts)) mesh.instanceMatrix.needsUpdate = true
    for (const mesh of Object.values(this.items)) mesh.instanceMatrix.needsUpdate = true
  }

  solve(s) {
    const a = s.agent
    const p = s.pose
    const look = a.look
    const i = s.index
    const h = look.height || 1
    const build = look.build || 1
    const root = new THREE.Matrix4().compose(_v.set(s.disp.x, 0, s.disp.z), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(h, h, h))
    const hips = root.clone().multiply(T(0, p.hipY, 0))
    const torso = hips.clone().multiply(R(p.spine))
    const put = (name, idx, base, local, scale) => {
      _m.copy(base).multiply(local)
      if (scale) _m.scale(scale)
      this.parts[name].setMatrixAt(idx, _m)
    }
    put('pelvis', i, hips, T(0, 0.02, 0), _v.set(build, 1, 1))
    put('torso', i, torso, T(0, 0.33, 0), _v.set(1.05 * build, 1, 1))
    const head = torso.clone().multiply(T(0, 0.78, 0.01)).multiply(R(p.head, p.headYaw))
    put('head', i, head, T(0, 0, 0))
    put('eye', i * 2, head, T(0.042, 0.02, 0.104))
    put('eye', i * 2 + 1, head, T(-0.042, 0.02, 0.104))
    put(`hair_${s.hair}`, i, head, T(0, 0, 0))
    this.headPositions.set(a.id, new THREE.Vector3().setFromMatrixPosition(head))

    let rightHand = null
    for (const side of [1, -1]) {
      const L = side === 1
      const slot = i * 2 + (L ? 0 : 1)
      const sh = torso.clone().multiply(T(0.2 * side * build, 0.55, 0)).multiply(R(L ? p.lSh : p.rSh, 0, (L ? p.lShR : p.rShR) * side))
      put('upperArm', slot, sh, T(0, -0.14, 0))
      const el = sh.clone().multiply(T(0, -0.29, 0)).multiply(R(L ? p.lEl : p.rEl))
      put('foreArm', slot, el, T(0, -0.12, 0))
      const hand = el.clone().multiply(T(0, -0.27, 0))
      put('hand', slot, hand, T(0, 0, 0))
      if (!L) rightHand = hand

      const hip = hips.clone().multiply(T(0.09 * side, -0.04, 0)).multiply(R(L ? p.lHip : p.rHip))
      put('thigh', slot, hip, T(0, -0.2, 0))
      const knee = hip.clone().multiply(T(0, -0.43, 0)).multiply(R(L ? p.lKnee : p.rKnee))
      put('shin', slot, knee, T(0, -0.2, 0))
      const ankle = knee.clone().multiply(T(0, -0.43, 0)).multiply(R(-(L ? p.lHip + p.lKnee : p.rHip + p.rKnee) * 0.85))
      put('shoe', slot, ankle, T(0, 0, 0))
    }
    for (const [kind, mesh] of Object.entries(this.items)) {
      if (a.carry === kind) {
        _m.copy(rightHand).multiply(T(0, -0.04, 0.04))
        mesh.setMatrixAt(i, _m)
      } else mesh.setMatrixAt(i, ZERO)
    }
  }

  /** Agent id nearest to a screen point (px), or null. */
  pick(px, py, camera, width, height, radius = 42) {
    let best = null
    let bestD = radius
    for (const [id, pos] of this.headPositions) {
      for (const dy of [0, -0.55]) {
        _v.copy(pos).add({ x: 0, y: dy, z: 0 }).project(camera)
        if (_v.z > 1) continue
        const sx = ((_v.x + 1) / 2) * width
        const sy = ((1 - _v.y) / 2) * height
        const d = Math.hypot(sx - px, sy - py)
        if (d < bestD) (bestD = d), (best = id)
      }
    }
    return best
  }

  positionOf(id) {
    const s = this.slots.get(id)
    return s ? new THREE.Vector3(s.disp.x, 0, s.disp.z) : null
  }
}
