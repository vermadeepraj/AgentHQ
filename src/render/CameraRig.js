// Camera: damped orbit / pan / zoom over the office, follow-an-agent mode,
// smooth focus moves, and a slow cinematic drift for the start screen.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { layout } from '../sim/index.js'

const { BOUNDS } = layout
const HOME = { target: new THREE.Vector3(-1, 0, 1), position: new THREE.Vector3(13, 23, 25) }

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera
    camera.position.copy(HOME.target).add(HOME.position.clone().sub(HOME.target).setLength(this.homeDistance()))
    const c = new OrbitControls(camera, dom)
    c.target.copy(HOME.target)
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.minDistance = 6
    c.maxDistance = 90
    c.minPolarAngle = 0.15
    c.maxPolarAngle = 1.25
    c.screenSpacePanning = false
    c.zoomToCursor = true
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls = c
    this.followPos = null
    this.flyTo = null
    this.drift = false
    this.keys = new Set()
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return
      this.keys.add(e.key.toLowerCase())
    })
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    c.addEventListener('start', () => {
      this.flyTo = null
    })
  }

  /** Smoothly move the orbit target (and optionally distance) somewhere. */
  focus(x, z, distance = null) {
    this.flyTo = { target: new THREE.Vector3(x, 0, z), distance }
  }

  /** Pull back on tall/narrow screens so the whole floor still fits. */
  homeDistance() {
    const fit = Math.min(2.2, Math.max(1, 1.25 / this.camera.aspect))
    return HOME.position.distanceTo(HOME.target) * fit
  }

  home() {
    this.flyTo = { target: HOME.target.clone(), distance: this.homeDistance() }
  }

  update(dt) {
    const c = this.controls
    if (this.drift) {
      const off = this.camera.position.clone().sub(c.target)
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.04)
      this.camera.position.copy(c.target).add(off)
    }
    // Keyboard panning (WASD / arrows), relative to the view direction.
    const fwd = new THREE.Vector3().subVectors(c.target, this.camera.position).setY(0).normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))
    const move = new THREE.Vector3()
    if (this.keys.has('w') || this.keys.has('arrowup')) move.add(fwd)
    if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(fwd)
    if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right)
    if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right)
    if (move.lengthSq()) {
      this.followPos = null
      move.normalize().multiplyScalar(dt * 14)
      c.target.add(move)
      this.camera.position.add(move)
    }

    const goal = this.followPos ? this.followPos : this.flyTo?.target
    if (goal) {
      const k = 1 - Math.exp(-(this.followPos ? 5 : 3.5) * dt)
      const delta = goal.clone().sub(c.target).multiplyScalar(k)
      c.target.add(delta)
      this.camera.position.add(delta)
      if (this.flyTo?.distance) {
        const off = this.camera.position.clone().sub(c.target)
        off.setLength(off.length() + (this.flyTo.distance - off.length()) * k)
        this.camera.position.copy(c.target).add(off)
      }
      if (this.flyTo && delta.length() < 0.002) this.flyTo = null
    }
    // Keep the view over the building.
    const clamped = c.target.clone()
    clamped.x = THREE.MathUtils.clamp(clamped.x, BOUNDS.minX - 4, BOUNDS.maxX + 4)
    clamped.z = THREE.MathUtils.clamp(clamped.z, BOUNDS.minZ - 4, BOUNDS.maxZ + 6)
    clamped.y = 0
    this.camera.position.add(clamped.clone().sub(c.target))
    c.target.copy(clamped)
    c.update()
  }
}
