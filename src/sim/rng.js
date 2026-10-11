// Seeded PRNG (mulberry32). Its whole state is the uint32 in `S.rng`, so a
// snapshot of S captures the random stream too — essential for replays.

export function rand(S) {
  let t = (S.rng = (S.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const randInt = (S, min, max) => min + Math.floor(rand(S) * (max - min + 1))
export const pick = (S, list) => list[Math.floor(rand(S) * list.length)]
export const chance = (S, p) => rand(S) < p
