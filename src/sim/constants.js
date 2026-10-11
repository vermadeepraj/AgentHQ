// Simulation-wide tuning constants. See docs/PLAN.md §2 for the time model.

export const TICKS_PER_SECOND = 20
export const MIN_PER_TICK = 0.1 // game minutes per tick while anyone is in the office
export const NIGHT_MIN_PER_TICK = 2.5 // game minutes per tick while the office is empty
export const WALK_PER_TICK = 0.1 // metres per tick (2 m/s at 1× — brisk office walk)
export const SNAPSHOT_EVERY = 300 // ticks between timeline snapshots

export const WORK_START = 9 * 60
export const WORK_END = 18 * 60
export const CRUNCH_EXTRA = 4 * 60 // crunch mode keeps people until ~22:00

export const WORK_SPEED = 2 // global pace multiplier for ticket work

export const STATUSES = ['todo', 'doing', 'review', 'qa', 'done']

export const PRICES = { pizza: 150, hire: 500 }
export const MAX_HIRES = 4
