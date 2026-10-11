// Renderer, scene, camera and the post-processing chain:
// N8AO (ambient occlusion, renders the scene) → bloom → output (tone map) → SMAA.
// "low" quality skips AO and uses a lower pixel ratio.

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { N8AOPass } from 'n8ao'
import { CameraRig } from './CameraRig.js'

export class Stage {
  constructor(canvas, { quality = 'high' } = {}) {
    this.quality = quality
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.3, 400)
    this.rig = new CameraRig(this.camera, canvas)
    this.size = { w: 1, h: 1 }
    this.buildComposer()
    this.resize()
    addEventListener('resize', () => this.resize())
  }

  buildComposer() {
    const { renderer, scene, camera } = this
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
    const composer = new EffectComposer(renderer, target)
    if (this.quality === 'high') {
      this.ao = new N8AOPass(scene, camera, 1, 1)
      this.ao.configuration.aoRadius = 0.9
      this.ao.configuration.distanceFalloff = 1.2
      this.ao.configuration.intensity = 2.6
      this.ao.configuration.gammaCorrection = false
      this.ao.setQualityMode('Medium')
      composer.addPass(this.ao)
    } else {
      composer.addPass(new RenderPass(scene, camera))
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.15)
    composer.addPass(this.bloom)
    composer.addPass(new OutputPass())
    composer.addPass(new SMAAPass())
    this.composer = composer
  }

  resize() {
    const w = innerWidth
    const h = innerHeight
    const dpr = Math.min(devicePixelRatio || 1, this.quality === 'high' ? 1.75 : 1)
    this.size = { w, h }
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** viewShift: fraction of the screen height to slide the scene up (room for a bottom sheet). */
  applyShift(dt) {
    const goal = this.viewShift || 0
    const now = this.shiftNow || 0
    if (Math.abs(goal - now) < 0.0005 && !now) return
    this.shiftNow = now + (goal - now) * (1 - Math.exp(-8 * dt))
    const { w, h } = this.size
    if (Math.abs(this.shiftNow) < 0.0005 && !goal) {
      this.shiftNow = 0
      this.camera.clearViewOffset()
    } else this.camera.setViewOffset(w, h, 0, this.shiftNow * h, w, h)
  }

  render(dt) {
    this.applyShift(dt)
    this.rig.update(dt)
    this.composer.render(dt)
  }

  get drawCalls() {
    return this.renderer.info.render.calls
  }
}
