// Furniture geometry, one builder per layout type. Local space: the item's
// front faces +z, its centre is at the origin, y = 0 is the floor.
// Screens, LEDs and boards are separate meshes (see Office.js).

import * as THREE from 'three'
import { GeoBuilder } from './builder.js'

const C = {
  white: '#f1efe9', offWhite: '#e7e3da', graphite: '#30333a', dark: '#1f2126', steel: '#a9aeb5',
  oak: '#c49a6c', walnut: '#6e4b33', fabric: '#56657a', fabricWarm: '#a5623f', green: '#4f8a4a',
  greenDark: '#356b3a', terracotta: '#b9694a', pot: '#e4ded3', cork: '#b88c5a', blue: '#225f86',
}

const B = () => new GeoBuilder()

export const BUILDERS = {
  desk() {
    return B()
      .box(1.6, 0.04, 0.8, C.white, 0, 0.71)
      .box(0.04, 0.71, 0.72, C.graphite, -0.76, 0)
      .box(0.04, 0.71, 0.72, C.graphite, 0.76, 0)
      .box(1.48, 0.36, 0.02, C.graphite, 0, 0.32, 0.36)
      .box(0.44, 0.02, 0.14, C.dark, -0.05, 0.75, -0.16)
      .box(0.06, 0.02, 0.1, C.dark, 0.3, 0.75, -0.15)
      .box(0.05, 0.22, 0.05, C.graphite, 0, 0.75, 0.24)
      .box(0.22, 0.015, 0.16, C.graphite, 0, 0.75, 0.24)
      .box(0.64, 0.4, 0.03, C.dark, 0, 0.86, 0.22)
      .cyl(0.04, 0.035, 0.1, '#e8e2d6', 0.6, 0.75, -0.1, 10)
      .build()
  },
  chair() {
    const b = B()
      .box(0.48, 0.07, 0.46, C.graphite, 0, 0.42)
      .box(0.46, 0.5, 0.05, C.graphite, 0, 0.52, -0.24, { rx: -0.12 })
      .cyl(0.025, 0.025, 0.36, C.steel, 0, 0.07)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      b.box(0.04, 0.03, 0.3, C.dark, Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14, { ry: a })
    }
    return b.box(0.04, 0.03, 0.3, C.dark, -0.25, 0.62, 0).box(0.04, 0.03, 0.3, C.dark, 0.25, 0.62, 0).build()
  },
  meetingTable() {
    return B()
      .box(4.4, 0.05, 1.6, C.walnut, 0, 0.72)
      .box(0.5, 0.72, 0.9, C.graphite, -1.4, 0)
      .box(0.5, 0.72, 0.9, C.graphite, 1.4, 0)
      .box(0.3, 0.02, 0.2, C.dark, 0, 0.77, 0)
      .build()
  },
  sofa(f) {
    const color = f?.color || C.fabric
    return B()
      .box(2.2, 0.42, 0.9, color, 0, 0.04)
      .box(2.2, 0.5, 0.22, color, 0, 0.4, -0.34)
      .box(0.2, 0.25, 0.9, color, -1.0, 0.46)
      .box(0.2, 0.25, 0.9, color, 1.0, 0.46)
      .box(0.96, 0.1, 0.62, '#6c7d93', -0.5, 0.46, 0.08)
      .box(0.96, 0.1, 0.62, '#6c7d93', 0.5, 0.46, 0.08)
      .box(2.0, 0.04, 0.8, C.dark, 0, 0, 0)
      .build()
  },
  coffeeTable() {
    return B().box(1.2, 0.04, 0.6, C.oak, 0, 0.38).box(1.1, 0.36, 0.5, C.graphite, 0, 0.02).box(0.25, 0.08, 0.18, '#d8553f', 0.3, 0.42, 0).build()
  },
  counter() {
    const b = B()
      .box(6, 0.86, 0.6, C.white, 0, 0)
      .box(6.04, 0.04, 0.64, '#d9d5cc', 0, 0.86)
      .box(6, 0.7, 0.35, C.white, 0, 1.5, -0.12)
      .box(0.6, 0.04, 0.4, C.steel, 1.2, 0.9, 0.02)
    for (let i = -2.5; i <= 2.5; i += 1) b.box(0.02, 0.7, 0.01, '#cfcac0', i, 0.1, 0.305)
    return b.build()
  },
  coffeeMachine() {
    return B()
      .box(0.36, 0.42, 0.34, C.dark, 0, 0.9)
      .box(0.3, 0.1, 0.06, '#c0392b', 0, 1.16, 0.15)
      .cyl(0.05, 0.05, 0.08, '#f4f1ea', 0, 0.92, 0.12, 10)
      .build()
  },
  fridge() {
    return B().box(0.8, 1.9, 0.7, '#cfd3d8', 0, 0).box(0.03, 0.5, 0.04, C.steel, 0.3, 1.1, 0.37).box(0.8, 0.02, 0.71, '#9aa0a6', 0, 1.2, 0).build()
  },
  diningTable() {
    return B()
      .box(2.4, 0.05, 1, C.oak, 0, 0.72)
      .box(0.06, 0.72, 0.06, C.graphite, -1.1, 0, -0.4)
      .box(0.06, 0.72, 0.06, C.graphite, 1.1, 0, -0.4)
      .box(0.06, 0.72, 0.06, C.graphite, -1.1, 0, 0.4)
      .box(0.06, 0.72, 0.06, C.graphite, 1.1, 0, 0.4)
      .build()
  },
  stool() {
    return B().cyl(0.18, 0.18, 0.05, C.oak, 0, 0.62).cyl(0.025, 0.025, 0.6, C.graphite, 0, 0.02).cyl(0.16, 0.16, 0.02, C.graphite, 0, 0).build()
  },
  waterCooler() {
    return B().box(0.32, 0.9, 0.32, C.white, 0, 0).cyl(0.13, 0.13, 0.42, '#9fd3ff', 0, 0.9, 0, 14).build()
  },
  rack() {
    const b = B().box(0.6, 2.05, 1, C.dark, 0, 0).box(0.56, 1.9, 0.02, '#2a2d34', 0, 0.08, 0.5)
    for (let y = 0.2; y < 1.9; y += 0.16) b.box(0.5, 0.01, 0.01, '#3b3f48', 0, y, 0.515)
    return b.build()
  },
  deviceTable() {
    const b = B().box(1.4, 0.04, 0.7, C.white, 0, 0.72).box(0.04, 0.72, 0.6, C.graphite, -0.66, 0).box(0.04, 0.72, 0.6, C.graphite, 0.66, 0)
    for (let i = 0; i < 5; i++) b.box(0.08, 0.012, 0.15, i % 2 ? '#20232a' : '#e8e8ea', -0.5 + i * 0.24, 0.76, 0)
    return b.build()
  },
  bookshelf() {
    const b = B().box(2, 2, 0.4, C.oak, 0, 0)
    const cols = ['#c0392b', '#2c3e50', '#16a085', '#f39c12', '#8e44ad', '#ecf0f1', '#d35400', '#27ae60']
    for (let s = 0; s < 4; s++) {
      b.box(1.9, 0.38, 0.02, '#8a6a46', 0, 0.12 + s * 0.47, -0.18)
      let x = -0.9
      let k = s * 3
      while (x < 0.85) {
        const w = 0.04 + ((k * 37) % 5) * 0.012
        b.box(w, 0.26 + ((k * 13) % 4) * 0.025, 0.24, cols[k % cols.length], x + w / 2, 0.12 + s * 0.47, 0.02)
        x += w + 0.008
        k++
      }
    }
    return b.build()
  },
  plant() {
    return B()
      .cyl(0.2, 0.15, 0.42, C.pot, 0, 0)
      .sphere(0.3, C.green, 0, 0.75, 0, { sy: 1.2 })
      .sphere(0.22, C.greenDark, 0.12, 1.0, 0.05)
      .sphere(0.2, C.green, -0.1, 1.08, -0.06)
      .sphere(0.16, '#5fa058', 0.02, 1.25, 0)
      .build()
  },
  pingpong() {
    return B()
      .box(2.74, 0.04, 1.52, C.blue, 0, 0.72)
      .box(2.74, 0.005, 0.02, '#ffffff', 0, 0.765, 0)
      .box(0.02, 0.16, 1.66, '#e8e8e8', 0, 0.76, 0)
      .box(0.08, 0.72, 1.2, C.graphite, -0.9, 0)
      .box(0.08, 0.72, 1.2, C.graphite, 0.9, 0)
      .build()
  },
  reception() {
    return B()
      .box(2.4, 1.05, 0.8, C.white, 0, 0)
      .box(2.42, 0.6, 0.02, C.oak, 0, 0.3, 0.41)
      .box(2.5, 0.04, 0.4, '#d9d5cc', 0, 1.05, 0.25)
      .box(0.5, 0.3, 0.03, C.dark, 0.3, 1.1, -0.1)
      .build()
  },
  kanban() {
    return B()
      .box(0.06, 2.3, 0.06, C.graphite, -2.05, 0)
      .box(0.06, 2.3, 0.06, C.graphite, 2.05, 0)
      .box(4.2, 1.9, 0.05, '#e9e9e6', 0, 0.38)
      .box(0.5, 0.03, 0.4, C.graphite, -2.05, 0)
      .box(0.5, 0.03, 0.4, C.graphite, 2.05, 0)
      .build()
  },
  lobbyScreen() {
    return B()
      .box(0.12, 3, 0.12, C.graphite, -1.6, 0)
      .box(0.12, 3, 0.12, C.graphite, 1.6, 0)
      .box(4.5, 2.6, 0.12, C.dark, 0, 0.55)
      .box(1.2, 0.05, 0.5, C.graphite, 0, 0)
      .build()
  },
  whiteboard() {
    return B().box(2.5, 1.4, 0.04, '#b9bec6', 0, 0.85).box(2.4, 0.04, 0.1, '#9aa0a8', 0, 0.82, 0.05).build()
  },
  tv() {
    return B().box(1.7, 1.0, 0.05, C.dark, 0, 1.1).build()
  },
  moodboard() {
    const b = B().box(3, 1.3, 0.04, C.cork, 0, 1.0)
    const cards = ['#ff6fd8', '#ffb547', '#5ee7ff', '#ffffff', '#54ffb0', '#f4d6c6', '#a98bff', '#ffffff', '#e08a3c']
    cards.forEach((col, i) => b.box(0.42, 0.3, 0.01, col, -1.2 + (i % 5) * 0.6 + (i > 4 ? 0.3 : 0), 1.15 + (i > 4 ? 0.45 : 0) - (i % 2) * 0.05, 0.03))
    return b.build()
  },
  lamp() {
    return B()
      .box(1.8, 0.05, 0.14, C.graphite, 0, 2.55)
      .box(0.006, 0.4, 0.006, C.dark, -0.7, 2.6)
      .box(0.006, 0.4, 0.006, C.dark, 0.7, 2.6)
      .build()
  },
  beanbag() {
    return B().sphere(0.45, '#d4793a', 0, 0.22, 0, { sy: 0.55 }, 2).build()
  },
}

/** Emissive panels that glow (lamp undersides, rack LEDs). */
export function lampGlowGeometry() {
  return new GeoBuilder().box(1.7, 0.01, 0.1, '#ffffff', 0, 2.545).build()
}

export function rackLedGeometry() {
  const b = new GeoBuilder()
  for (let r = 0; r < 10; r++) {
    for (let k = 0; k < 4; k++) {
      const col = (r * 7 + k * 3) % 11 === 0 ? '#ffb547' : (r + k) % 3 === 0 ? '#5ee7ff' : '#54ffb0'
      b.box(0.025, 0.012, 0.01, col, -0.2 + k * 0.05, 0.25 + r * 0.17, 0.52)
    }
  }
  return b.build()
}

export const SCREEN_SIZE = {
  desk: [0.6, 0.36],
  kanban: [4.08, 1.8],
  lobbyScreen: [4.3, 2.42],
  whiteboard: [2.4, 1.3],
  tv: [1.62, 0.92],
}

export const MATERIAL_COLORS = C

/** Simple outdoor tree. */
export function treeGeometry() {
  return new GeoBuilder()
    .cyl(0.08, 0.12, 1.6, '#6b4b33', 0, 0)
    .sphere(0.9, '#4d7f45', 0, 2.1, 0, { sy: 1.1 })
    .sphere(0.6, '#5a9150', 0.4, 2.6, 0.2)
    .sphere(0.55, '#3f7140', -0.35, 2.5, -0.25)
    .build()
}

export function streetLampGeometry() {
  return new GeoBuilder().cyl(0.05, 0.07, 3.6, '#2b2e33', 0, 0).box(0.5, 0.06, 0.14, '#2b2e33', 0.2, 3.55).build()
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d)
