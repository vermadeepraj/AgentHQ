# AgentHQ

A playable 3D office where a team of AI agents takes a brief and ships it — kickoff at the
whiteboard, tickets on the Kanban, design handoffs, code reviews, QA bounces, a deploy, and a
launch party around the lobby screen. **You're the CEO**: assign work, order pizza, hire
contractors, decide when to crunch, and answer the client when they call.

Every agent's reasoning is visible: click anyone to see their needs and the utility scores
behind their last decision.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # simulation test suite
npm run build   # production bundle in dist/
```

### Live AI (optional)

Everything runs offline by default. To let Claude drive the agents, copy `.env.example` to
`.env.local` and set `ANTHROPIC_API_KEY`, then restart `npm run dev`. With a key:

- **Free play** — Priya, the PM, is Claude: your brief becomes a real ticket plan and the copy
  for the website that appears on the lobby screen at launch.
- **Talk to anyone** — select an agent and type into the box under their profile. They answer
  in character from their actual state (energy, memory, the board) and can act on it
  ("take a break", "work on #105", "go home").

The key stays on the server: `server/agent.js` is a small proxy served by the Vite dev server
and deployable as `api/agent.js` (serverless). It builds the prompts itself from capped,
structured fields, forces structured tool output, and rate-limits per client. AI output only
enters the simulation as the starting plan or as recorded commands, so runs stay replayable.

## Scenarios

| Scenario | Challenge |
|---|---|
| Startup MVP — Chai & Co. | Tutorial: the team can ship on its own; help them ship better |
| 3 AM Outage | Checkout is down; choose who to page while revenue bleeds |
| Scope Creep — PulseFit | The client calls mid-sprint; accept or negotiate |
| Demo Day — MediMind | 1.5× too much work; crunch, hire, or bribe with pizza |
| Free play | Type any brief; the PM (Claude, with live AI) turns it into a plan |

## How it's built

```
src/
  app/        App.js — wires worker frames to renderer + UI
  sim/        headless, deterministic simulation (no DOM, no three.js)
    world/      layout.js (floor plan, single source of truth) · nav.js (A* + smoothing)
    agents/     roster · lifecycle · needs · movement · plans
    brains/     scripted.js (utility AI) · actions.js (plan builders)
    work/       tickets · meetings · scoring
    scenarios/  mvp · outage · scopeCreep · crunch · freeplay
    tick.js · commands.js · state.js · timeline.js (rewind / replay / branching)
  worker/     sim.worker.js + SimClient.js (20 Hz frames)
  render/     Stage (N8AO → bloom → SMAA) · CameraRig · Lighting (day/night)
    office/     Office.js · furniture.js · boards.js (live canvas boards)
    people/     People.js (one InstancedMesh per body part) · poses.js
    fx/         Effects.js (ping arcs, confetti, alarm)
  ai/         AgentAI — client for the Claude proxy · offline conversation brain
  audio/      Sound — procedural WebAudio (room tone, keyboards, event cues, siren); no files
  ui/         Hud · Kanban · Inspector · Dock (actions + timeline) · Feed · Tags · Modals · Coach (first-run tips)
  styles/     tokens.css · base.css · ui.css
tests/sim/    determinism, timeline, navigation, agents, commands, scenario balance
docs/PLAN.md  full design document
```

Key ideas:

- **Deterministic simulation.** World state is one plain JSON object; randomness is a seeded
  PRNG stored in that object. Same seed + same commands ⇒ the same run, so the timeline can
  rewind by restoring a snapshot and replaying.
- **Utility AI.** Each idle agent scores every option (work, review, test, coffee, lunch, pizza,
  break, go home…) and picks the best; the top three are shown in the inspector.
- **~20 draw calls for all the people.** Each body part is one instanced mesh shared by every
  agent; joints are solved in JS from procedural poses.
- **No downloaded assets.** Furniture, characters and textures are generated in code.

- **Procedural audio.** Room tone, keyboards and every cue are synthesised with WebAudio.
