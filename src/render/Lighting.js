// Day/night cycle driven by the simulation clock: sun path and colour, sky,
// fog, environment strength, and the office's own lights at dusk.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const SUNRISE = 6.25 * 60
const SUNSET = 19.25 * 60
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const SKY = { day: new THREE.Color('#9ec3e6'), gold: new THREE.Color('#f0a874'), night: new THREE.Color('#0a1020') }
const SUN = { low: new THREE.Color('#ffae68'), high: new THREE.Color('#fff3e2'), moon: new THREE.Color('#8ea6ff') }

export class Lighting {
  constructor(scene, renderer) {
    this.scene = scene
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.hemi = new THREE.HemisphereLight('#bcd7ff', '#9c8268', 1)
    scene.add(this.hemi)

    const sun = new THREE.DirectionalLight('#ffffff', 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const cam = sun.shadow.camera
    cam.left = -26
    cam.right = 26
    cam.top = 20
    cam.bottom = -20
    cam.near = 1
    cam.far = 140
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.03
    sun.shadow.radius = 2
    scene.add(sun, sun.target)
    this.sun = sun

    // Office ceiling lights: a wide overhead spot that covers the floor plate
    // but falls off outside the building, so the street stays dark at night.
    this.interior = new THREE.SpotLight('#ffe2b8', 0, 0, Math.atan(21 / 34), 0.35, 0)
    this.interior.position.set(0, 34, 0)
    this.interior.target.position.set(0, 0, 0)
    scene.add(this.interior, this.interior.target)

    this.background = new THREE.Color()
    scene.background = this.background
    scene.fog = new THREE.Fog(this.background, 70, 190)
    this.tmp = new THREE.Color()
  }

  /** Returns { lights, night } in 0..1 for other systems (lamps, screens). */
  update(clock, peopleInside) {
    const m = ((clock % 1440) + 1440) % 1440
    const dayT = (m - SUNRISE) / (SUNSET - SUNRISE)
    const elev = dayT > 0 && dayT < 1 ? Math.sin(Math.PI * dayT) : 0
    const day = smooth(0, 0.25, elev)
    const night = 1 - day

    if (elev > 0) {
      const a = Math.PI * dayT
      this.sun.position.set(Math.cos(a) * 45, 12 + Math.sin(a) * 48, 28)
      this.sun.color.copy(SUN.low).lerp(SUN.high, smooth(0, 0.5, elev))
      this.sun.intensity = 2.1 * smooth(0, 0.12, elev)
    } else {
      this.sun.position.set(-20, 45, 18)
      this.sun.color.copy(SUN.moon)
      this.sun.intensity = 0.18
    }

    const golden = smooth(0.35, 0, elev) * day
    this.background.copy(SKY.night).lerp(SKY.day, day).lerp(SKY.gold, golden * 0.7)
    this.scene.fog.color.copy(this.background)

    const lights = Math.min(1, night * 1.3) * (peopleInside ? 1 : 0.12)
    this.hemi.intensity = 0.06 + day * 0.59 + lights * 0.12
    this.hemi.color.copy(SKY.night).lerp(this.tmp.set('#d6e6ff'), day)
    this.interior.intensity = lights * 1.7
    this.scene.environmentIntensity = 0.04 + day * 0.36 + lights * 0.14
    return { lights, night, day }
  }
}
