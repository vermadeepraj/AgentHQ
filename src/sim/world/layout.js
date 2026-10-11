// The office floor plan — single source of truth for the simulation (navigation,
// interaction spots) and the renderer (meshes). Metres; origin at the centre;
// +x east, +z south; yaw 0 faces +z. See docs/PLAN.md §3 for the map.

const PI = Math.PI

export const BOUNDS = { minX: -18, maxX: 18, minZ: -12, maxZ: 12 }
export const WALL_HEIGHT = 3
export const LOW_WALL_HEIGHT = 1
export const WALL_THICKNESS = 0.2

/** @type {{x1:number,z1:number,x2:number,z2:number,kind:'window'|'solid'|'glass'|'low'}[]} */
export const walls = []
/** @type {{type:string,x:number,z:number,yaw:number,w:number,d:number,block:boolean}[]} */
export const furniture = []
/** Interaction spots by id: where an agent stands/sits and which way they face. */
export const spots = {}
/** Desks by id, each with its seat. */
export const desks = {}
/** Named zones, used for labels and camera presets. */
export const zones = [
  { id: 'server', label: 'Server Room', x: -14.5, z: -8.5 },
  { id: 'lab', label: 'Test Lab', x: -7.5, z: -8.5 },
  { id: 'design', label: 'Design Studio', x: 1, z: -8.5 },
  { id: 'conference', label: 'Conference', x: 13, z: -7.5 },
  { id: 'kitchen', label: 'Kitchen', x: -14.5, z: 1 },
  { id: 'engineering', label: 'Engineering', x: -3.5, z: 1.5 },
  { id: 'product', label: 'Product', x: 5.2, z: 1.5 },
  { id: 'lounge', label: 'Lounge', x: -14, z: 9 },
  { id: 'lobby', label: 'Lobby', x: 13, z: 8 },
]

const wall = (x1, z1, x2, z2, kind) => walls.push({ x1, z1, x2, z2, kind })
const spot = (id, x, z, yaw, kind) => (spots[id] = { id, x, z, yaw, kind })
const item = (type, x, z, yaw, w, d, extra) =>
  furniture.push({ type, x, z, yaw, w, d, block: true, ...extra })
const decor = (type, x, z, yaw = 0, extra) =>
  furniture.push({ type, x, z, yaw, w: 0, d: 0, block: false, ...extra })

/** Axis-aligned footprint of a furniture item (yaw is always a multiple of 90°). */
export function footprint(f) {
  const swap = Math.abs(Math.sin(f.yaw)) > 0.5
  const hw = (swap ? f.d : f.w) / 2
  const hd = (swap ? f.w : f.d) / 2
  return { minX: f.x - hw, maxX: f.x + hw, minZ: f.z - hd, maxZ: f.z + hd }
}

// ── Walls ────────────────────────────────────────────────────────────────
// Exterior: north + west full height with windows; south + east low (cutaway).
wall(-18, -12, 18, -12, 'window')
wall(-18, -12, -18, 12, 'window')
wall(-18, 12, 12, 12, 'low')
wall(14, 12, 18, 12, 'low') // entrance gap x 12..14
wall(18, -12, 18, 12, 'low')
// Server room
wall(-11, -12, -11, -5, 'solid')
wall(-18, -5, -14.3, -5, 'glass')
wall(-12.9, -5, -11, -5, 'glass')
// Test lab
wall(-4, -12, -4, -5, 'solid')
wall(-11, -5, -8.3, -5, 'glass')
wall(-6.9, -5, -4, -5, 'glass')
// Conference room
wall(8, -12, 8, -4.9, 'solid')
wall(8, -3.5, 8, -3, 'solid')
wall(8, -3, 18, -3, 'glass')

// ── Desks ────────────────────────────────────────────────────────────────
function addDesk(group, team, x, z, yaw) {
  const n = Object.values(desks).filter((d) => d.group === group).length
  const id = `${group}-${n}`
  const seat = { x: x - Math.sin(yaw) * 0.75, z: z - Math.cos(yaw) * 0.75, yaw }
  desks[id] = { id, group, team, x, z, yaw, seat }
  item('desk', x, z, yaw, 1.6, 0.8, { team, desk: id })
  decor('chair', seat.x, seat.z, yaw, { desk: id })
  spot(`desk:${id}`, seat.x, seat.z, yaw, 'desk')
}

/** Two facing rows of `cols` desks; monitors meet back-to-back along the centre line. */
function pod(group, team, cx, cz, cols) {
  for (let i = 0; i < cols; i++) addDesk(group, team, cx + (i - (cols - 1) / 2) * 1.7, cz - 0.4, 0)
  for (let i = 0; i < cols; i++) addDesk(group, team, cx + (i - (cols - 1) / 2) * 1.7, cz + 0.4, PI)
}

pod('eng', 'eng', -7, 1.5, 3) // eng-0..5
pod('eng', 'eng', -0.5, 1.5, 3) // eng-6..11
pod('product', 'product', 5.2, 1.5, 1) // product-0..1
pod('design', 'design', 1, -8.5, 2) // design-0..3
pod('qa', 'qa', -7.5, -9, 1) // qa-0..1
addDesk('ops', 'ops', -11.6, -9.5, PI / 2) // ops-0, against the server-room wall

// Pendant lamps above the pods (render only).
for (const [x, z] of [[-7, 1.5], [-0.5, 1.5], [5.2, 1.5], [1, -8.5], [-7.5, -9]]) decor('lamp', x, z)

// ── Conference room ─────────────────────────────────────────────────────
item('meetingTable', 13.5, -7.5, 0, 4.4, 1.6)
;[11.9, 13.5, 15.1].forEach((x, i) => {
  spot(`meet:${i}`, x, -8.75, 0, 'meet')
  decor('chair', x, -8.75, 0)
  spot(`meet:${i + 3}`, x, -6.25, PI, 'meet')
  decor('chair', x, -6.25, PI)
})
spot('meet:6', 16.3, -7.5, -PI / 2, 'meet')
decor('chair', 16.3, -7.5, -PI / 2)
decor('whiteboard', 8.12, -8, PI / 2) // on the wall, facing east
spot('whiteboard', 8.85, -8, -PI / 2, 'present')
decor('tv', 17.88, -7.5, -PI / 2)

// ── Product area & lobby ────────────────────────────────────────────────
item('kanban', 13, -2.65, 0, 4.2, 0.3)
item('lobbyScreen', 13, 4.3, 0, 4.4, 0.4)
item('reception', 15.8, 8.5, -PI / 2, 2.4, 0.8)
item('sofa', 10, 9, PI / 2, 2.2, 0.9)
spot('lobby:0', 10.2, 8.45, PI / 2, 'seat')
spot('lobby:1', 10.2, 9.55, PI / 2, 'seat')
decor('rug', 11.4, 9, 0, { w: 3.2, d: 2.6, color: '#3c4a5c' })
spot('exit', 13, 11.4, PI, 'exit')

// ── Kitchen ─────────────────────────────────────────────────────────────
item('counter', -17.6, 0.5, PI / 2, 6, 0.6)
decor('coffeeMachine', -17.6, -0.5, PI / 2)
spot('coffee', -16.85, -0.5, -PI / 2, 'coffee')
item('fridge', -17.5, 4.3, PI / 2, 0.8, 0.7)
item('diningTable', -14, 1, 0, 2.4, 1)
;[-14.8, -14, -13.2].forEach((x, i) => {
  spot(`stool:${i}`, x, 0.2, 0, 'stool')
  decor('stool', x, 0.2)
  spot(`stool:${i + 3}`, x, 1.8, PI, 'stool')
  decor('stool', x, 1.8)
})
item('waterCooler', -11.5, -2.5, 0, 0.4, 0.4)
spot('water', -11.5, -1.85, PI, 'water')

// ── Lounge & games ──────────────────────────────────────────────────────
item('sofa', -16.9, 9, PI / 2, 2.2, 0.9)
spot('lounge:0', -16.7, 8.45, PI / 2, 'seat')
spot('lounge:1', -16.7, 9.55, PI / 2, 'seat')
item('sofa', -13, 11.3, PI, 2.2, 0.9)
spot('lounge:2', -13.55, 11.1, PI, 'seat')
spot('lounge:3', -12.45, 11.1, PI, 'seat')
item('coffeeTable', -14.2, 9.2, 0, 1.2, 0.6)
decor('beanbag', -11.4, 8.2, -PI / 2)
spot('lounge:4', -11.4, 8.2, -PI / 2, 'seat')
decor('rug', -14.4, 9.4, 0, { w: 4.2, d: 3.2, color: '#5a4a3c' })
item('pingpong', -2.5, 9.2, 0, 2.74, 1.52)
spot('pp:0', -4.3, 9.2, PI / 2, 'pingpong')
spot('pp:1', -0.7, 9.2, -PI / 2, 'pingpong')

// ── Server room, test lab, design studio ───────────────────────────────
for (let i = 0; i < 5; i++) {
  const x = -17.1 + i * 0.68
  item('rack', x, -10.9, 0, 0.6, 1)
  item('rack', x, -8.1, PI, 0.6, 1)
}
spot('rack:0', -15.4, -9.5, PI, 'rack')
spot('rack:1', -16.6, -9.5, 0, 'rack')
item('deviceTable', -5.3, -10.8, 0, 1.4, 0.7)
item('bookshelf', 4.6, -11.75, 0, 2, 0.4)
decor('moodboard', 0.6, -11.88, 0)

// ── Plants ──────────────────────────────────────────────────────────────
for (const [x, z] of [
  [-10.4, -11.4], [7.4, -11.4], [-3.4, -5.6], [6.2, -5.6], [7.3, -2.4], [-17.3, 5.6],
  [17.3, 4.6], [9.4, 4.6], [-8.6, 11.4], [2.6, 11.4], [6.8, 11.4], [17.3, 11.3], [-17.3, -11.3],
]) item('plant', x, z, 0, 0.5, 0.5)

// ── Gathering spots (computed; snapped to walkable cells by the meeting system) ──
export const GATHER = {
  standup: { kind: 'circle', x: 13, z: -0.4, r: 1.7 },
  allhands: { kind: 'circle', x: 13, z: -0.4, r: 1.9 },
  celebrate: { kind: 'rows', x: 10.4, z: 5.9, dx: 0.85, dz: 1, perRow: 7, yaw: PI },
  drill: { kind: 'rows', x: 10.6, z: 10.4, dx: 0.8, dz: 0.8, perRow: 7, yaw: PI },
}

export const EXIT = spots.exit
