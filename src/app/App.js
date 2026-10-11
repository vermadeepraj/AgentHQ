// Wires the layers together: worker frames → renderer + UI; UI intents → commands.

import { Stage } from '../render/Stage.js'
import { Office } from '../render/office/Office.js'
import { People } from '../render/people/People.js'
import { Lighting } from '../render/Lighting.js'
import { Effects } from '../render/fx/Effects.js'
import { Sound } from '../audio/Sound.js'
import { AgentAI, chatCommands } from '../ai/AgentAI.js'
import { SimClient } from '../worker/SimClient.js'
import { layout } from '../sim/index.js'
import { UI } from '../ui/UI.js'

const params = new URLSearchParams(location.search)
const EVENT_COLORS = { review: '#54ffb0', handoff: '#ff6fd8', qaReject: '#ff4f6d' }

export class App {
  constructor({ canvas, tags, ui }) {
    const mobile = matchMedia('(max-width: 820px), (hover: none)').matches
    this.stage = new Stage(canvas, { quality: params.get('quality') || (mobile ? 'low' : 'high') })
    this.stage.renderer.info.autoReset = false
    const { scene, renderer } = this.stage
    this.lighting = new Lighting(scene, renderer)
    this.office = new Office(scene)
    this.people = new People(scene)
    this.fx = new Effects(scene)
    this.sim = new SimClient()
    this.sound = new Sound()
    this.ai = new AgentAI()
    this.session = null
    this.ui = new UI(this, { root: ui, tags })
    this.frame = null
    this.state = null
    this.selected = null
    this.hover = null
    this.following = false
    this.mode = 'attract' // attract → playing
    this.last = performance.now()
    this.time = 0
    this.fps = { frames: 0, acc: 0, value: 60 }
    this.sim.onFrame((f) => this.onFrame(f))
    this.bindPointer(canvas)
  }

  boot() {
    const scenario = params.get('scenario')
    if (scenario) this.play(scenario, { seed: Number(params.get('seed') || 1), speed: Number(params.get('speed') || 1), brief: params.get('brief') || '' })
    else this.attract()
    requestAnimationFrame((t) => this.loop(t))
  }

  /** Living backdrop behind the start screen. */
  attract() {
    this.mode = 'attract'
    this.sim.start('mvp', { seed: 7, speed: 2 })
    this.stage.rig.drift = true
    this.sound.enabled = false
    this.ui.showStart()
  }

  play(scenario, opts = {}) {
    this.mode = 'playing'
    this.selected = null
    this.following = false
    this.people.slots.forEach((s) => this.people.hide(s))
    this.people.slots.clear()
    this.session = { scenario, brief: opts.brief || '', plan: opts.plan || null }
    this.sim.start(scenario, { seed: opts.seed ?? Math.floor(Math.random() * 1e6), brief: this.session.brief, plan: this.session.plan, speed: opts.speed ?? 1 })
    this.stage.rig.drift = false
    this.sound.enabled = true
    this.stage.rig.home()
    this.ui.startSession(scenario)
  }

  command(cmd) {
    this.sim.command(cmd)
  }

  /** Free play: the AI product manager drafts the plan first (null → keyword templates). */
  async playFree(brief) {
    const plan = await this.ai.plan(brief)
    this.play('free', { brief, plan })
  }

  /** CEO talks to an agent; the reply (Claude or offline) and any action become commands. */
  async askAgent(id, message) {
    const r = await this.ai.chat(this.state, id, message)
    if (!r || this.mode !== 'playing') return r
    for (const c of chatCommands(id, message, r)) this.command(c)
    return r
  }

  select(id, { follow = false } = {}) {
    this.selected = id
    this.following = !!id && follow
    if (id && !follow) {
      const p = this.people.positionOf(id)
      if (p) this.stage.rig.focus(p.x, p.z)
    }
    this.ui.onSelect(id)
  }

  onFrame(f) {
    this.frame = f
    this.state = f.state
    this.people.setAgents(f.state.agents, performance.now())
    for (const e of f.events) this.onEvent(e)
    this.ui.onFrame(f)
  }

  onEvent(e) {
    const head = (id) => this.people.headPositions.get(id)
    if (e.type === 'ping' || e.type === 'handoff' || e.type === 'qaReject') {
      this.fx.arc(head(e.from), head(e.to), EVENT_COLORS[e.kind || e.type] || '#7cf7ff')
    } else if (e.type === 'deployed') {
      const screen = layout.furniture.find((f) => f.type === 'lobbyScreen')
      this.fx.celebrate(screen.x, screen.z + 1)
      if (this.mode === 'playing') this.stage.rig.focus(screen.x, screen.z + 3, 22)
    }
    this.sound.event(e)
    this.ui.onEvent(e)
  }

  bindPointer(canvas) {
    let down = null
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }))
    canvas.addEventListener('pointermove', (e) => {
      this.hover = this.people.pick(e.clientX, e.clientY, this.stage.camera, innerWidth, innerHeight)
      canvas.style.cursor = this.hover ? 'pointer' : ''
    })
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      if (this.mode !== 'playing') return
      const id = this.people.pick(e.clientX, e.clientY, this.stage.camera, innerWidth, innerHeight)
      this.select(id)
    })
    canvas.addEventListener('dblclick', (e) => {
      const id = this.people.pick(e.clientX, e.clientY, this.stage.camera, innerWidth, innerHeight)
      if (id && this.mode === 'playing') this.select(id, { follow: true })
    })
  }

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt))
    const dt = Math.min(0.05, (t - this.last) / 1000)
    this.last = t
    this.time += dt
    const now = performance.now()
    const S = this.state
    this.stage.renderer.info.reset()
    if (S) {
      const inside = S.agents.some((a) => a.present && !a.hidden)
      const { lights, night } = this.lighting.update(S.clock, inside)
      this.office.update(S, this.time, lights, night)
      this.people.update(dt, this.time, now)
      const sel = this.selected && S.agents.find((a) => a.id === this.selected)
      const selPos = sel && sel.present && !sel.hidden ? this.people.positionOf(sel.id) : null
      this.stage.rig.followPos = this.following && selPos ? selPos : null
      this.fx.update(dt, this.time, {
        state: S,
        selectedPos: selPos,
        selectedTeam: sel?.team,
        hoverPos: this.hover && this.hover !== this.selected ? this.people.positionOf(this.hover) : null,
      })
    }
    this.sound.update(dt, S, this.frame)
    const parts = this.ui.parts
    const sheet = innerWidth <= 900 && parts && (this.selected || parts.inspector.open || parts.kanban.open)
    this.stage.viewShift = sheet ? 0.22 : 0
    this.stage.render(dt)
    this.ui.update(dt, now)
    this.fps.frames++
    this.fps.acc += dt
    if (this.fps.acc > 0.5) {
      this.fps.value = Math.round(this.fps.frames / this.fps.acc)
      this.fps.frames = 0
      this.fps.acc = 0
    }
  }
}
