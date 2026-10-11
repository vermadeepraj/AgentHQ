// Procedural sound: everything is synthesised with WebAudio — no audio files.
// Room tone + keyboards follow the office's activity; sim events get short cues;
// the outage gets a siren. Starts on the first user gesture (autoplay rules).

const STORE_KEY = 'agenthq.muted'
const MASTER = 0.55
const MIN_GAP = { ping: 0.18, handoff: 0.3, ticketStage: 0.25, qaPass: 0.3, qaReject: 0.4, arrive: 0.4, leave: 0.4 }

function load() {
  try {
    return localStorage.getItem(STORE_KEY) === '1'
  } catch {
    return false
  }
}

export class Sound {
  constructor() {
    this.ctx = null
    this.muted = load()
    this.enabled = false // cues only during a session; the start screen gets room tone only
    this.last = {}
    this.typingAcc = 0
    const unlock = () => {
      this.unlock()
      removeEventListener('pointerdown', unlock, true)
      removeEventListener('keydown', unlock, true)
    }
    addEventListener('pointerdown', unlock, true)
    addEventListener('keydown', unlock, true)
  }

  unlock() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = (this.ctx = new Ctx())
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : MASTER
    this.master.connect(comp)
    this.noiseBuf = this.makeNoise(2)
    this.buildRoomTone()
    this.buildSiren()
  }

  setMuted(v) {
    this.muted = v
    try {
      localStorage.setItem(STORE_KEY, v ? '1' : '0')
    } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(v ? 0 : MASTER, this.ctx.currentTime, 0.05)
  }

  // ── Building blocks ───────────────────────────────────────────────────
  makeNoise(seconds) {
    const ctx = this.ctx
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let brown = 0
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1
      brown = (brown + 0.02 * white) / 1.02
      d[i] = i % 2 ? white : brown * 3.5 // interleave: white for clicks, brown for rumble
    }
    return buf
  }

  noiseSource() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    return src
  }

  buildRoomTone() {
    const ctx = this.ctx
    const src = this.noiseSource()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    this.room = ctx.createGain()
    this.room.gain.value = 0
    src.connect(lp).connect(this.room).connect(this.master)
    src.start()
  }

  buildSiren() {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 720
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.9
    const depth = ctx.createGain()
    depth.gain.value = 170
    lfo.connect(depth).connect(osc.frequency)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    this.siren = ctx.createGain()
    this.siren.gain.value = 0
    osc.connect(lp).connect(this.siren).connect(this.master)
    osc.start()
    lfo.start()
  }

  /** A single enveloped oscillator note. */
  tone(freq, { at = 0, dur = 0.18, type = 'sine', gain = 0.12, to = null, attack = 0.008 } = {}) {
    const ctx = this.ctx
    const t = ctx.currentTime + at
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  /** A filtered noise burst (clicks, whooshes, pops). */
  burst({ at = 0, dur = 0.03, freq = 3000, q = 1.2, gain = 0.05, type = 'bandpass' } = {}) {
    const ctx = this.ctx
    const t = ctx.currentTime + at
    const src = this.noiseSource()
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.02)
  }

  chord(notes, opts = {}) {
    notes.forEach((n, i) => this.tone(n, { ...opts, at: (opts.at || 0) + i * (opts.step ?? 0) }))
  }

  // ── Per-frame ambience ────────────────────────────────────────────────
  update(dt, S, frame) {
    if (!this.ctx || !S) return
    if (this.ctx.state === 'suspended') this.ctx.resume()
    const now = this.ctx.currentTime
    const present = S.agents.filter((a) => a.present && !a.hidden)
    const busy = present.length / Math.max(1, S.agents.length)
    this.room.gain.setTargetAtTime(0.025 + busy * 0.07, now, 0.6)
    const live = frame && !frame.paused
    this.siren.gain.setTargetAtTime(this.enabled && live && S.outage?.active ? 0.035 : 0, now, 0.15)
    if (!live || this.muted) return
    // Keyboards: each typing agent clicks a few times a second, capped.
    const typing = present.filter((a) => a.act === 'type').length
    this.typingAcc += dt * Math.min(typing, 8) * 2.4 * (this.enabled ? 1 : 0.5)
    while (this.typingAcc > 1) {
      this.typingAcc -= 1
      if (Math.random() < 0.55) this.burst({ at: Math.random() * 0.05, dur: 0.018, freq: 2500 + Math.random() * 2500, gain: 0.025 + Math.random() * 0.02 })
    }
  }

  // ── Event cues ────────────────────────────────────────────────────────
  event(e) {
    if (!this.ctx || !this.enabled || this.muted) return
    const now = this.ctx.currentTime
    const gap = MIN_GAP[e.type] ?? 0.1
    if (now - (this.last[e.type] || -1) < gap) return
    this.last[e.type] = now
    const cue = CUES[e.type]
    if (cue) cue(this, e)
  }

  ui() {
    if (!this.ctx || this.muted) return
    this.tone(1200, { dur: 0.05, type: 'triangle', gain: 0.05, to: 900 })
  }
}

// Notes in Hz (equal temperament, A4 = 440).
const N = { C4: 261.6, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5 }

const CUES = {
  ping: (s) => s.tone(N.E5, { dur: 0.12, type: 'sine', gain: 0.06, to: N.A5 }),
  handoff: (s) => s.chord([N.G4, N.D5], { step: 0.08, dur: 0.22, type: 'triangle', gain: 0.07 }),
  ticketStage: (s, e) => {
    if (e.status === 'done') s.chord([N.C5, N.G5], { step: 0.06, dur: 0.2, type: 'triangle', gain: 0.06 })
    else if (e.status === 'review') s.tone(N.A4, { dur: 0.14, type: 'triangle', gain: 0.05, to: N.D5 })
  },
  qaPass: (s) => s.chord([N.E5, N.G5, N.C6], { step: 0.07, dur: 0.25, type: 'sine', gain: 0.06 }),
  qaReject: (s) => {
    s.tone(180, { dur: 0.28, type: 'square', gain: 0.05, to: 120 })
    s.tone(140, { at: 0.12, dur: 0.3, type: 'square', gain: 0.04, to: 95 })
  },
  ticketsCreated: (s) => s.chord([N.C5, N.E5, N.G5], { step: 0.05, dur: 0.3, type: 'triangle', gain: 0.05 }),
  meetingStart: (s) => s.chord([N.G5, N.E5], { step: 0.22, dur: 0.7, type: 'sine', gain: 0.07 }),
  decision: (s) => {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) s.tone(i % 2 ? 1400 : 1100, { at: r * 0.7 + i * 0.05, dur: 0.05, type: 'square', gain: 0.025 })
  },
  pizza: (s) => s.chord([N.E5, N.C5], { step: 0.35, dur: 0.6, type: 'sine', gain: 0.09 }), // ding-dong
  hire: (s) => s.chord([N.C5, N.E5, N.G5, N.C6], { step: 0.06, dur: 0.2, type: 'triangle', gain: 0.05 }),
  arrive: (s) => s.burst({ dur: 0.25, freq: 600, q: 0.6, gain: 0.03, type: 'lowpass' }),
  page: (s) => {
    for (let i = 0; i < 3; i++) s.tone(N.A5, { at: i * 0.16, dur: 0.1, type: 'square', gain: 0.035 })
  },
  alarm: (s) => s.tone(900, { dur: 0.5, type: 'sawtooth', gain: 0.06, to: 500 }),
  resolved: (s) => s.chord([N.G4, N.C5, N.E5, N.G5], { step: 0.09, dur: 0.4, type: 'triangle', gain: 0.06 }),
  deployed: (s) => {
    s.burst({ dur: 0.9, freq: 400, q: 0.5, gain: 0.08, type: 'lowpass' }) // whoosh
    s.chord([N.C5, N.E5, N.G5, N.C6], { at: 0.25, step: 0.1, dur: 0.6, type: 'triangle', gain: 0.07 })
    for (let i = 0; i < 14; i++) s.burst({ at: 0.6 + Math.random() * 1.2, dur: 0.04, freq: 1500 + Math.random() * 3000, gain: 0.04 }) // party poppers
  },
  chaos: (s, e) => {
    if (e.kind === 'viral') s.chord([N.C5, N.E5, N.G5, N.C6, N.E5 * 2], { step: 0.05, dur: 0.25, type: 'sine', gain: 0.05 })
    else if (e.kind === 'drill') for (let i = 0; i < 6; i++) s.tone(1000, { at: i * 0.12, dur: 0.08, type: 'square', gain: 0.04 })
    else s.tone(300, { dur: 0.5, type: 'sawtooth', gain: 0.05, to: 80 }) // power-down
  },
  crunch: (s, e) => (e.on ? s.tone(110, { dur: 0.6, type: 'sawtooth', gain: 0.06, to: 220 }) : s.tone(220, { dur: 0.4, type: 'sine', gain: 0.05, to: 110 })),
  outcome: (s, e) => {
    if (e.result === 'win') s.chord([N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6], { step: 0.09, dur: 0.9, type: 'triangle', gain: 0.06 })
    else s.chord([N.G4, 370, 349.2, 311.1], { step: 0.32, dur: 0.6, type: 'triangle', gain: 0.06 })
  },
}
