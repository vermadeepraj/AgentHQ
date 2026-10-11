// Main-thread handle to the simulation worker.

export class SimClient {
  constructor() {
    this.worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' })
    this.listeners = new Set()
    this.last = null
    this.worker.onmessage = ({ data }) => {
      if (data.type !== 'frame') return
      this.last = data
      for (const fn of this.listeners) fn(data)
    }
  }

  start(scenario, { seed = 1, brief = '', plan = null, speed = 1, paused = false } = {}) {
    this.worker.postMessage({ type: 'init', scenario, seed, brief, plan, speed, paused })
  }

  command(cmd) {
    this.worker.postMessage({ type: 'cmd', cmd })
  }

  setSpeed(value) {
    this.worker.postMessage({ type: 'speed', value })
  }

  pause(value) {
    this.worker.postMessage({ type: 'pause', value })
  }

  seek(tick) {
    this.worker.postMessage({ type: 'seek', tick })
  }

  onFrame(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  dispose() {
    this.worker.terminate()
    this.listeners.clear()
  }
}
