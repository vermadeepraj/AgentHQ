// Visual effects layered on the office: selection rings, "Slack ping" arcs,
// launch confetti, outage alarm lights.

import * as THREE from 'three'
import { TEAMS } from '../../sim/index.js'

const ARC_POOL = 12
const CONFETTI = 700

const arcMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uT; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float head = uT * 1.4;
        float d = head - vUv.x;
        float a = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.05, 0.45, d));
        a *= 1.0 - smoothstep(0.85, 1.0, uT);
        gl_FragColor = vec4(uColor * 2.2, a);
      }`,
  })

export class Effects {
  constructor(scene) {
    this.scene = scene
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 48).rotateX(-Math.PI / 2)
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#7cf7ff', transparent: true, toneMapped: false, depthWrite: false }))
    this.ring.position.y = 0.025
    this.hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }))
    this.hoverRing.position.y = 0.024
    scene.add(this.ring, this.hoverRing)

    this.arcs = Array.from({ length: ARC_POOL }, () => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), arcMaterial())
      mesh.visible = false
      mesh.frustumCulled = false
      scene.add(mesh)
      return { mesh, t: 1 }
    })

    const pos = new Float32Array(CONFETTI * 3)
    const col = new Float32Array(CONFETTI * 3)
    const palette = ['#ff6fd8', '#ffb547', '#5ee7ff', '#54ffb0', '#a98bff', '#ffffff'].map((c) => new THREE.Color(c))
    for (let i = 0; i < CONFETTI; i++) palette[i % palette.length].toArray(col, i * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.confetti = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, toneMapped: false, transparent: true }))
    this.confetti.visible = false
    this.confetti.frustumCulled = false
    this.vel = new Float32Array(CONFETTI * 3)
    this.confettiT = 0
    scene.add(this.confetti)

    this.alarmLights = [new THREE.PointLight('#ff2a3d', 0, 18, 1.6), new THREE.PointLight('#ff2a3d', 0, 40, 1.2)]
    this.alarmLights[0].position.set(-14.5, 2.7, -8.5)
    this.alarmLights[1].position.set(-2, 7, 1)
    scene.add(...this.alarmLights)
  }

  arc(from, to, color = '#7cf7ff') {
    if (!from || !to) return
    const slot = this.arcs.find((a) => a.t >= 1) || this.arcs[0]
    const a = from.clone().add({ x: 0, y: 0.25, z: 0 })
    const b = to.clone().add({ x: 0, y: 0.25, z: 0 })
    const mid = a.clone().lerp(b, 0.5)
    mid.y += 1.2 + a.distanceTo(b) * 0.18
    slot.mesh.geometry.dispose()
    slot.mesh.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 40, 0.035, 6)
    slot.mesh.material.uniforms.uColor.value.set(color)
    slot.mesh.visible = true
    slot.t = 0
  }

  celebrate(x, z) {
    const p = this.confetti.geometry.attributes.position.array
    for (let i = 0; i < CONFETTI; i++) {
      p[i * 3] = x + (Math.random() - 0.5) * 4
      p[i * 3 + 1] = 2.5 + Math.random() * 1.5
      p[i * 3 + 2] = z + (Math.random() - 0.5) * 2
      this.vel[i * 3] = (Math.random() - 0.5) * 3
      this.vel[i * 3 + 1] = 2 + Math.random() * 4
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 3 + 1.5
    }
    this.confetti.visible = true
    this.confettiT = 6
  }

  update(dt, time, { state, selectedPos, selectedTeam, hoverPos }) {
    this.ring.visible = !!selectedPos
    if (selectedPos) {
      this.ring.position.x = selectedPos.x
      this.ring.position.z = selectedPos.z
      this.ring.material.color.set(TEAMS[selectedTeam]?.color || '#7cf7ff')
      this.ring.material.opacity = 0.75 + 0.25 * Math.sin(time * 4)
      this.ring.scale.setScalar(1 + 0.05 * Math.sin(time * 4))
    }
    this.hoverRing.visible = !!hoverPos
    if (hoverPos) this.hoverRing.position.set(hoverPos.x, 0.024, hoverPos.z)

    for (const a of this.arcs) {
      if (a.t >= 1) continue
      a.t = Math.min(1, a.t + dt / 1.6)
      a.mesh.material.uniforms.uT.value = a.t
      if (a.t >= 1) a.mesh.visible = false
    }

    if (this.confettiT > 0) {
      this.confettiT -= dt
      const p = this.confetti.geometry.attributes.position.array
      for (let i = 0; i < CONFETTI; i++) {
        this.vel[i * 3 + 1] -= 4.5 * dt
        this.vel[i * 3] *= 0.99
        p[i * 3] += this.vel[i * 3] * dt + Math.sin(time * 6 + i) * 0.004
        p[i * 3 + 1] = Math.max(0.02, p[i * 3 + 1] + this.vel[i * 3 + 1] * dt)
        p[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      }
      this.confetti.geometry.attributes.position.needsUpdate = true
      this.confetti.material.opacity = Math.min(1, this.confettiT)
      if (this.confettiT <= 0) this.confetti.visible = false
    }

    const alarm = state?.outage?.active ? 0.5 + 0.5 * Math.sin(time * 7) : 0
    this.alarmLights[0].intensity = alarm * 260
    this.alarmLights[1].intensity = alarm * 160
  }
}
