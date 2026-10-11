# AgentHQ

A playable 3D office where teams of AI agents (product, design, engineering, QA, DevOps) take a
brief and build it — kickoff, tickets, reviews, QA bounces, deploys. The player is the CEO.
Full design: `docs/PLAN.md`. Current progress: the **Status** table below.
Next: `docs/REAL_PLAN.md` — agents that build and ship real projects (planned, not built).

## Commands

```bash
npm run dev      # Vite dev server → http://localhost:5173
npm test         # Vitest — simulation tests (Node, no browser)
npm run build    # production build → dist/
npm run shot     # screenshots of the running app → scripts/out/ (needs `npm run dev` running)
npm run e2e:ai   # live-AI flow end to end with a mocked /api/agent (needs `npm run dev`)
```

## Architecture — four layers, dependencies point down only

```
ui/      DOM overlay (HUD, Kanban, inspector, timeline)   ← reads frames, sends commands
render/  three.js view of the world                        ← reads frames, never mutates sim
audio/   procedural WebAudio cues                         ← reads frames + events, like render/
ai/      client for the Claude proxy + offline chat brain  ← turns AI output into plan/commands
worker/  Web Worker hosting the sim + main-thread client
sim/     headless deterministic simulation                 ← no DOM, no three, no Math.random
```

- `src/app/` wires everything together (start screen → session → end screen).
- The **only** link between sim and the page is the worker message protocol in `src/worker/`.
- `server/agent.js` is the Claude proxy (key stays server-side). Served by `server/vitePlugin.js`
  in dev/preview and by `api/agent.js` when hosted. Key: `ANTHROPIC_API_KEY` in `.env.local`.

## Rules that must not be broken

1. **`src/sim/` is pure and deterministic.** No `window`, `document`, `three`, `Date`, `Math.random`
   or timers. Randomness only via `rand(S)` from `sim/rng.js` (its state lives in `S.rng`).
2. **All sim state is one plain JSON object `S`** — no classes, functions, Maps or cyclic refs.
   It must survive `structuredClone`. Static data (layout, nav grid, roster, scenarios) stays in
   modules, never in `S`.
3. **The player changes the world only through commands** (`sim/commands.js`), recorded by
   `Timeline` with their tick. Same seed + same commands ⇒ identical run (this powers rewind/replay).
4. **`sim/world/layout.js` is the single source of truth** for walls, furniture and spots. The
   renderer builds the office from it; never hard-code positions in `render/`.
5. Render reads frames only. Visual-only state (interpolation, bubbles timers) lives in `render/` / `ui/`.
6. **AI output never touches `S` directly.** It enters as the `plan` init option (validated by
   `sim/scenarios/aiPlan.js`) or as ordinary recorded commands (`voice`, `assign`, `break`…).
   Everything must still work with no API key.

## Conventions

- Vanilla JS, ES modules, no framework, no TypeScript. JSDoc only where a shape isn't obvious.
- 2-space indent, single quotes, no semicolons.
- Units: metres and radians. `yaw = 0` faces +z (south); forward vector is `(sin yaw, cos yaw)`.
- Time: `S.clock` is game minutes since Day 1 00:00. Helpers in `sim/clock.js`.
- Files stay focused (~300 lines max); split by responsibility, not by type.
- Colours/fonts for the UI come from CSS custom properties in `src/styles/tokens.css`.

## Debugging

- URL params: `?scenario=mvp|outage|scope|crunch|free&seed=N&speed=1..8&brief=...&quality=low` skip the start screen.
- `window.__agenthq` is the App instance (state, sim, stage, people).
- Headless balance runs: `tests/sim/helpers.js` → `runScenario(id, { seed })`.

## Verifying changes

- Sim changes → `npm test`. Balance changes → check the scenario report printed by
  `tests/sim/scenarios.test.js`.
- Visual changes → run the dev server, then `npm run shot` and look at the PNGs.
  Phone layout: `VIEWPORT=390x844 node scripts/screenshot.mjs "?scenario=mvp" phone`.
- First-run tips are stored in `localStorage['agenthq.tips']`; mute in `localStorage['agenthq.muted']`.
- Performance budget: 60 fps mid-range laptop, ~150 draw calls (currently ~110 incl. AO + shadow passes; static furniture is one merged mesh), first load < 3 MB (currently ~0.3 MB gzip).

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundations: tooling, worker bridge, tests | done |
| 1 | Office: layout, meshes, lighting, camera, day/night | done |
| 2 | People: instanced characters, poses, navigation | done |
| 3 | Brains: tickets, utility AI, meetings, routines | done |
| 4 | Showing the work: boards, bubbles, handoffs, inspector | done |
| 5 | Game layer: commands, scenarios, scoring, timeline | done |
| 6 | Real AI: Claude PM plans free play + writes the site; talk to agents | done |
| 7 | Polish: procedural audio, first-run coach tips, phone layout | done |
