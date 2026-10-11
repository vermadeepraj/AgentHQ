// Procedural poses. A pose is a set of joint angles (radians) + hip height.
// Conventions (character faces +z): negative hip/shoulder pitch = limb forward,
// positive knee = natural bend, negative elbow = forearm forward/up,
// positive roll = arm out to the side, positive spine/head = lean/look down.

export const JOINTS = ['hipY', 'spine', 'head', 'headYaw', 'lSh', 'rSh', 'lShR', 'rShR', 'lEl', 'rEl', 'lHip', 'rHip', 'lKnee', 'rKnee']

const STAND = { hipY: 0.97, spine: 0, head: 0, headYaw: 0, lSh: 0.04, rSh: 0.04, lShR: 0.07, rShR: 0.07, lEl: -0.15, rEl: -0.15, lHip: 0, rHip: 0, lKnee: 0.02, rKnee: 0.02 }

const sitAt = (hipY, knee = 1.5) => ({ ...STAND, hipY, lHip: -1.45, rHip: -1.45, lKnee: knee, rKnee: knee, spine: 0.04, lSh: -0.35, rSh: -0.35, lEl: -0.85, rEl: -0.85 })

const SEAT_HEIGHT = { desk: 0.53, meet: 0.53, stool: 0.72, seat: 0.47 }

/**
 * Target pose for an activity.
 * @param {string} act    simulation activity
 * @param {number} t      seconds (render clock)
 * @param {number} phase  walk-cycle phase (radians), advanced by distance travelled
 * @param {object} ctx    { seat: spot kind or null, carry, seed }
 */
export function targetPose(act, t, phase, ctx) {
  const s = ctx.seed
  const seatY = SEAT_HEIGHT[ctx.seat] ?? 0.53
  switch (act) {
    case 'walk': {
      const sin = Math.sin(phase)
      const cos = Math.cos(phase)
      const p = {
        ...STAND, spine: 0.06, hipY: 0.96 + 0.018 * Math.cos(2 * phase),
        lHip: -0.48 * sin, rHip: 0.48 * sin,
        lKnee: 0.1 + 0.65 * Math.max(0, cos), rKnee: 0.1 + 0.65 * Math.max(0, -cos),
        lSh: 0.38 * sin, rSh: -0.38 * sin, lEl: -0.35, rEl: -0.35,
      }
      if (ctx.carry) Object.assign(p, { rSh: -0.35, rEl: -1.25 })
      return p
    }
    case 'sit':
      return { ...sitAt(seatY), head: 0.05 * Math.sin(t * 0.7 + s), headYaw: 0.25 * Math.sin(t * 0.31 + s * 3) }
    case 'type': {
      const j = Math.sin(t * 17 + s) * 0.05
      return { ...sitAt(seatY), spine: 0.12, head: 0.16, lSh: -0.58 + j, rSh: -0.58 - j, lEl: -1.0, rEl: -1.0, lShR: 0.12, rShR: 0.12 }
    }
    case 'eat': {
      const bite = Math.max(0, Math.sin(t * 1.6 + s))
      return { ...sitAt(seatY, 1.25), spine: 0.1, head: 0.12, lSh: -0.5, lEl: -1.0, rSh: -0.5 - bite * 0.4, rEl: -1.1 - bite * 1.0 }
    }
    case 'lounge':
      return { ...sitAt(0.46, 1.25), lHip: -1.3, rHip: -1.3, spine: -0.28, head: -0.1, lSh: -0.1, rSh: -0.1, lShR: 0.35, rShR: 0.35, lEl: -0.3, rEl: -0.3 }
    case 'talk':
      return {
        ...STAND, head: 0.05 * Math.sin(t * 4 + s), headYaw: 0.12 * Math.sin(t * 0.9 + s),
        rSh: -0.4 + 0.25 * Math.sin(t * 3.1 + s), rEl: -1.15 + 0.2 * Math.sin(t * 2.2), rShR: 0.15,
        lSh: -0.15, lEl: -0.55 + 0.2 * Math.sin(t * 2.6 + 1),
      }
    case 'drink': {
      const sip = Math.max(0, Math.sin(t * 0.9 + s)) ** 2
      return { ...STAND, rSh: -0.3 - sip * 0.25, rEl: -1.05 - sip * 1.25, head: -0.1 * sip, lSh: 0.05 }
    }
    case 'present':
      return { ...STAND, head: -0.12, rSh: -2.25 + 0.18 * Math.sin(t * 2.4), rShR: 0.2 + 0.15 * Math.sin(t * 1.3), rEl: -0.3, lSh: -0.25, lEl: -0.5 }
    case 'celebrate': {
      const jump = Math.abs(Math.sin(t * 6.5 + s))
      return { ...STAND, hipY: 0.97 + jump * 0.12, lSh: -2.9, rSh: -2.9, lShR: 0.35 + 0.2 * jump, rShR: 0.35 + 0.2 * jump, lEl: -0.25, rEl: -0.25, lKnee: 0.3 * (1 - jump), rKnee: 0.3 * (1 - jump), lHip: -0.15 * (1 - jump), rHip: -0.15 * (1 - jump), head: -0.15 }
    }
    case 'frustrated':
      return { ...STAND, lSh: -2.45, rSh: -2.45, lShR: 0.75, rShR: 0.75, lEl: -2.3, rEl: -2.3, head: 0.25 }
    case 'pingpong': {
      const swing = Math.sin(t * 5.5 + s)
      return { ...STAND, hipY: 0.9, spine: 0.22, lHip: -0.3, rHip: -0.3, lKnee: 0.4, rKnee: 0.4, rSh: -0.7 + 0.6 * swing, rShR: 0.35 + 0.2 * swing, rEl: -0.9, lSh: -0.3, lEl: -0.9, headYaw: 0.2 * swing }
    }
    case 'tinker': {
      const j = Math.sin(t * 15 + s) * 0.05
      return { ...STAND, spine: 0.22, head: 0.25, lSh: -0.65 + j, rSh: -0.65 - j, lEl: -0.95, rEl: -0.95 }
    }
    default: {
      // stand / idle: breathing + glances
      const b = Math.sin(t * 1.4 + s)
      return { ...STAND, spine: 0.01 * b, headYaw: 0.3 * Math.sin(t * 0.37 + s * 2), lEl: -0.15 + 0.03 * b, rEl: -0.15 + 0.03 * b }
    }
  }
}

export const restPose = () => ({ ...STAND })
