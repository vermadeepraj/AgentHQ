// Builds the office from sim/world/layout.js: floors, walls, glass, instanced
// furniture (merged into one static mesh), screens and boards, and the street outside. Keeps the dynamic bits
// (monitors, boards, lamps, pizza) in sync with each frame.

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { layout } from '../../sim/index.js'
import { BUILDERS, lampGlowGeometry, rackLedGeometry, treeGeometry, streetLampGeometry, SCREEN_SIZE } from './furniture.js'
import { createBoards } from './boards.js'
import { GeoBuilder } from './builder.js'
import * as tex from '../textures.js'

const { BOUNDS, walls, furniture, desks, WALL_HEIGHT, LOW_WALL_HEIGHT, WALL_THICKNESS } = layout

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _c = new THREE.Color()

const matrixFor = (x, y, z, yaw, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, yaw), _s.set(sx, sy, sz))

const hash = (x, z) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const SCREEN_KIND = { eng: 'code', design: 'design', qa: 'qa', ops: 'ops', product: 'product' }

export class Office {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'office'
    scene.add(this.group)
    this.furnitureMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 })
    this.buildFloors()
    this.buildWalls()
    this.statics = [] // static vertex-coloured geometry, merged into one draw call
    this.buildFurniture()
    this.buildScreens()
    this.buildGlow()
    this.buildOutside()
    this.mergeStatics()
    this.buildPizza()
  }

  add(mesh, { cast = true, receive = true } = {}) {
    mesh.castShadow = cast
    mesh.receiveShadow = receive
    this.group.add(mesh)
    return mesh
  }

  // ── Floors ────────────────────────────────────────────────────────────
  buildFloors() {
    const W = BOUNDS.maxX - BOUNDS.minX
    const D = BOUNDS.maxZ - BOUNDS.minZ
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.3, D + 0.6), new THREE.MeshStandardMaterial({ color: '#8e9196', roughness: 0.9 }))
    slab.position.y = -0.151
    this.add(slab, { cast: false })

    const wood = tex.woodFloor()
    wood.repeat.set(W / 4, D / 4)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0 }))
    floor.rotation.x = -Math.PI / 2
    this.add(floor, { cast: false })

    const zone = (x1, z1, x2, z2, texture, metres, roughness = 0.9) => {
      const t = texture.clone()
      t.needsUpdate = true
      t.repeat.set((x2 - x1) / metres, (z2 - z1) / metres)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map: t, roughness }))
      m.rotation.x = -Math.PI / 2
      m.position.set((x1 + x2) / 2, 0.004, (z1 + z2) / 2)
      this.add(m, { cast: false })
    }
    zone(-18, -12, -11, -5, tex.tiles('#9097a0', '#6f757d', 4), 1.2, 0.6) // server: raised floor
    zone(-11, -12, -4, -5, tex.carpet('#475769'), 2) // test lab
    zone(8, -12, 18, -3, tex.carpet('#5f5550'), 2) // conference
    zone(-18, -3, -11, 5, tex.tiles('#ece8e0', '#cfc9bd', 4), 1.2, 0.5) // kitchen
    zone(8, 4, 18, 12, tex.concrete(), 4, 0.35) // lobby
    zone(-4, -12, 8, -5, tex.carpet('#58515f'), 2) // design studio
  }

  // ── Walls ─────────────────────────────────────────────────────────────
  buildWalls() {
    const solid = new GeoBuilder()
    const frame = new GeoBuilder()
    const glass = new GeoBuilder()
    const T = WALL_THICKNESS
    for (const w of walls) {
      const horiz = w.z1 === w.z2
      const len = horiz ? Math.abs(w.x2 - w.x1) : Math.abs(w.z2 - w.z1)
      const cx = (w.x1 + w.x2) / 2
      const cz = (w.z1 + w.z2) / 2
      const seg = (b, h, y, color, thick = T) => b.box(horiz ? len : thick, h, horiz ? thick : len, color, cx, y, cz)
      const along = (t) => (horiz ? [Math.min(w.x1, w.x2) + t, cz] : [cx, Math.min(w.z1, w.z2) + t])
      if (w.kind === 'solid') seg(solid, WALL_HEIGHT, 0, '#f3f1ec')
      else if (w.kind === 'low') {
        seg(solid, LOW_WALL_HEIGHT, 0, '#eeebe4')
        seg(frame, 0.06, LOW_WALL_HEIGHT, '#8a6a46', T + 0.06)
      } else if (w.kind === 'window') {
        seg(solid, 0.9, 0, '#f3f1ec')
        seg(solid, 0.4, 2.6, '#f3f1ec')
        seg(glass, 1.7, 0.9, '#ffffff', 0.03)
        const n = Math.max(1, Math.round(len / 2))
        for (let i = 0; i <= n; i++) {
          const [x, z] = along((i / n) * len)
          frame.box(horiz ? 0.07 : 0.14, 1.7, horiz ? 0.14 : 0.07, '#2b2e34', x, 0.9, z)
        }
        seg(frame, 0.05, 0.9, '#2b2e34', T + 0.04)
      } else if (w.kind === 'glass') {
        seg(frame, 0.08, 0, '#3a3e45', 0.1)
        seg(frame, 0.1, WALL_HEIGHT - 0.1, '#3a3e45', 0.1)
        seg(glass, WALL_HEIGHT - 0.18, 0.08, '#ffffff', 0.02)
        const n = Math.max(1, Math.round(len / 2.5))
        for (let i = 0; i <= n; i++) {
          const [x, z] = along((i / n) * len)
          frame.box(0.06, WALL_HEIGHT, 0.06, '#3a3e45', x, 0, z)
        }
      }
    }
    this.add(new THREE.Mesh(solid.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })))
    this.add(new THREE.Mesh(frame.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 })))
    const glassMesh = new THREE.Mesh(
      glass.build(),
      new THREE.MeshPhysicalMaterial({ color: '#d8ecf7', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
    )
    glassMesh.renderOrder = 10
    this.add(glassMesh, { cast: false, receive: false })
  }

  /** Queue a copy of `geo` at `matrix` for the merged static mesh. */
  addStatic(geo, matrix) {
    this.statics.push(geo.clone().applyMatrix4(matrix))
  }

  mergeStatics() {
    const mesh = new THREE.Mesh(mergeGeometries(this.statics), this.furnitureMat)
    mesh.name = 'statics'
    this.add(mesh)
    this.statics = null
  }

  // ── Furniture (merged; lamps stay instanced so they cast no shadow) ──
  buildFurniture() {
    const byType = {}
    for (const f of furniture) (byType[f.type] ||= []).push(f)
    for (const [type, items] of Object.entries(byType)) {
      if (type === 'rug') continue
      const builder = BUILDERS[type]
      if (!builder) continue
      const geo = builder(items[0])
      const matrices = items.map((f) => {
        const s = type === 'plant' ? 0.85 + hash(f.x, f.z) * 0.4 : 1
        const yaw = type === 'plant' ? hash(f.z, f.x) * Math.PI * 2 : f.yaw
        return matrixFor(f.x, 0, f.z, yaw, s, s, s)
      })
      if (type !== 'lamp') {
        matrices.forEach((m) => this.addStatic(geo, m))
        continue
      }
      const mesh = new THREE.InstancedMesh(geo, this.furnitureMat, items.length)
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
      mesh.name = type
      this.add(mesh, { cast: false })
    }
    const rugs = byType.rug || []
    const rugMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.012, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), rugs.length)
    rugs.forEach((f, i) => {
      rugMesh.setMatrixAt(i, matrixFor(f.x, 0.006, f.z, f.yaw, f.w, 1, f.d))
      rugMesh.setColorAt(i, _c.set(f.color))
    })
    this.add(rugMesh, { cast: false })
  }

  // ── Screens & boards ──────────────────────────────────────────────────
  buildScreens() {
    this.textures = {
      code: tex.codeScreen(),
      design: tex.designScreen(),
      qa: tex.dashScreen('#54ffb0'),
      ops: tex.dashScreen('#a98bff'),
      product: tex.dashScreen('#ffb547'),
    }
    const [sw, sh] = SCREEN_SIZE.desk
    const screenGeo = new THREE.PlaneGeometry(sw, sh)
    const local = matrixFor(0, 1.06, 0.204, Math.PI)
    const byKind = {}
    for (const d of Object.values(desks)) (byKind[SCREEN_KIND[d.team]] ||= []).push(d)
    this.monitors = []
    for (const [kind, list] of Object.entries(byKind)) {
      const mat = new THREE.MeshBasicMaterial({ map: this.textures[kind], toneMapped: false })
      const mesh = new THREE.InstancedMesh(screenGeo, mat, list.length)
      list.forEach((d, i) => {
        mesh.setMatrixAt(i, matrixFor(d.x, 0, d.z, d.yaw).multiply(local))
        mesh.setColorAt(i, _c.setScalar(0.05))
        this.monitors.push({ mesh, index: i, desk: d.id, level: 0.05 })
      })
      this.add(mesh, { cast: false, receive: false })
    }

    this.boards = createBoards()
    const plane = (type, board, y, z, lit) => {
      const f = furniture.find((x) => x.type === type)
      const [w, h] = SCREEN_SIZE[type]
      const mat = lit
        ? new THREE.MeshBasicMaterial({ map: board.texture, toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) })
        : new THREE.MeshStandardMaterial({ map: board.texture, roughness: 0.45 })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      mesh.applyMatrix4(matrixFor(f.x, 0, f.z, f.yaw).multiply(matrixFor(0, y, z, 0)))
      return this.add(mesh, { cast: false })
    }
    plane('kanban', this.boards.kanban, 1.33, 0.03, false)
    plane('whiteboard', this.boards.whiteboard, 1.55, 0.025, false)
    this.lobbyScreen = plane('lobbyScreen', this.boards.lobby, 1.85, 0.065, true)
    plane('tv', this.boards.tv, 1.6, 0.03, true)
  }

  // ── Emissive bits: lamp undersides and rack LEDs ─────────────────────
  buildGlow() {
    const lamps = furniture.filter((f) => f.type === 'lamp')
    this.lampMat = new THREE.MeshBasicMaterial({ color: '#fff3dc', toneMapped: false })
    const lampMesh = new THREE.InstancedMesh(lampGlowGeometry(), this.lampMat, lamps.length)
    lamps.forEach((f, i) => lampMesh.setMatrixAt(i, matrixFor(f.x, 0, f.z, f.yaw)))
    this.add(lampMesh, { cast: false, receive: false })

    const racks = furniture.filter((f) => f.type === 'rack')
    this.ledMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const ledMesh = new THREE.InstancedMesh(rackLedGeometry(), this.ledMat, racks.length)
    racks.forEach((f, i) => ledMesh.setMatrixAt(i, matrixFor(f.x, 0, f.z, f.yaw)))
    this.add(ledMesh, { cast: false, receive: false })
  }

  // ── Outside: street, grass, trees, lamps, sign ───────────────────────
  buildOutside() {
    const pave = tex.paving()
    pave.repeat.set(60, 60)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: pave, roughness: 0.95 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.3
    this.add(ground, { cast: false })
    const grassMat = new THREE.MeshStandardMaterial({ color: '#4f7a43', roughness: 1 })
    const patches = [[-4, 17.5, 26, 9], [26, 0, 12, 34], [-30, 0, 20, 40], [0, -22, 70, 16]]
    const grass = mergeGeometries(patches.map(([x, z, w, d]) => new THREE.BoxGeometry(w, 0.1, d).translate(x, -0.27, z)))
    this.add(new THREE.Mesh(grass, grassMat), { cast: false })
    const path = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 9), new THREE.MeshStandardMaterial({ color: '#c7c3bb', roughness: 0.8 }))
    path.position.set(13, -0.25, 16.5)
    this.add(path, { cast: false })

    const trees = [[-14, 16], [-8, 19], [-2, 16.5], [4, 19.5], [7.5, 15.5], [22, -8], [23, 2], [21.5, 9], [-23, -6], [-24, 6], [-10, -19], [5, -19.5], [15, -20]]
    const treeGeo = treeGeometry()
    trees.forEach(([x, z]) => {
      const s = 0.9 + hash(x, z) * 0.6
      this.addStatic(treeGeo, matrixFor(x, -0.25, z, hash(z, x) * 6, s, s, s))
    })

    this.streetLamps = [[10.6, 13.5], [15.4, 13.5], [-6, 13.2], [20, 13.2]]
    const lampGeo = streetLampGeometry()
    this.streetLamps.forEach(([x, z]) => this.addStatic(lampGeo, matrixFor(x, -0.25, z, 0)))
    this.streetGlowMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false })
    const glow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.03, 0.1), this.streetGlowMat, this.streetLamps.length)
    this.streetLamps.forEach(([x, z], i) => glow.setMatrixAt(i, matrixFor(x + 0.25, 3.27, z, 0)))
    this.add(glow, { cast: false })

    // Entrance sign.
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    const g = c.getContext('2d')
    g.fillStyle = '#16181d'
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = '#7cf7ff'
    g.font = '800 88px "Syne", "Arial Black", sans-serif'
    g.fillText('AgentHQ', 40, 112)
    const signTex = new THREE.CanvasTexture(c)
    signTex.colorSpace = THREE.SRGBColorSpace
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.25), [
      ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#16181d' })),
      new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }),
      new THREE.MeshStandardMaterial({ color: '#16181d' }),
    ])
    sign.position.set(9.6, 0.15, 14.2)
    this.add(sign)
  }

  buildPizza() {
    const b = new GeoBuilder()
    for (const [x, z] of [[-14.6, 1], [-14, 0.9], [-13.4, 1.05]]) {
      b.box(0.42, 0.05, 0.42, '#e7dcc8', x, 0.77, z)
      b.add(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20), '#e2a54a', { x, y: 0.83, z })
      b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 20), '#c4462f', { x, y: 0.835, z })
    }
    this.pizza = new THREE.Mesh(b.build(), this.furnitureMat)
    this.pizza.visible = false
    this.add(this.pizza)
  }

  /** `lights` = interior lighting factor 0..1, `night` = darkness 0..1. */
  update(state, time, lights, night) {
    this.boards.update(state)
    this.textures.code.offset.y = (time * 0.04) % 1
    this.pizza.visible = state.pizzaUntil > state.clock

    const owners = {}
    for (const a of state.agents) owners[a.desk] = a
    const dirty = new Set()
    for (const m of this.monitors) {
      const a = owners[m.desk]
      let target = 0.04
      if (a && a.present && !a.hidden) {
        const seat = layout.spots[`desk:${m.desk}`]
        target = Math.hypot(a.x - seat.x, a.z - seat.z) < 0.4 ? 0.95 : 0.5
      } else if (!night) target = 0.08
      if (Math.abs(target - m.level) > 0.01) {
        m.level += (target - m.level) * 0.15
        m.mesh.setColorAt(m.index, _c.setScalar(m.level))
        dirty.add(m.mesh)
      }
    }
    for (const mesh of dirty) mesh.instanceColor.needsUpdate = true

    this.lampMat.color.setRGB(1, 0.95, 0.86).multiplyScalar(0.25 + lights * 2.2)
    this.streetGlowMat.color.setRGB(1, 0.85, 0.6).multiplyScalar(0.2 + night * 3)
    this.ledMat.color.setScalar(0.75 + 0.25 * Math.sin(time * 9) * Math.sin(time * 2.3))
  }
}
