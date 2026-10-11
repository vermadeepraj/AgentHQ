// Tiny helper that merges coloured primitives into one BufferGeometry with
// vertex colours, so each furniture type becomes a single instanced draw call.

import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export class GeoBuilder {
  constructor() {
    this.parts = []
  }

  add(geometry, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose()
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))
    g.applyMatrix4(_m)
    const c = new THREE.Color(color)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    this.parts.push(g)
    return this
  }

  /** Box whose *bottom* sits at y. */
  box(w, h, d, color, x = 0, y = 0, z = 0, rot = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, { x, y: y + h / 2, z, ...rot })
  }

  /** Vertical cylinder whose bottom sits at y. */
  cyl(rTop, rBottom, h, color, x = 0, y = 0, z = 0, seg = 16, rot = {}) {
    return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, { x, y: y + h / 2, z, ...rot })
  }

  sphere(r, color, x = 0, y = 0, z = 0, scale = {}, detail = 1) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, { x, y, z, ...scale })
  }

  build() {
    const g = mergeGeometries(this.parts)
    this.parts = []
    g.computeBoundingSphere()
    return g
  }
}
