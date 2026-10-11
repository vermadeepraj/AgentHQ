# AgentHQ — Design & Build Plan

## 1. Concept

The player is the CEO. They give the company a brief; a 3D office of AI agents runs the project:
kickoff at the whiteboard → tickets on the Kanban → design, build, review, QA bounces → DevOps
deploys → the lobby screen shows the shipped product → celebration and a graded result.

Decisions: scripted + replay brains first (free, offline); live Claude later via a serverless
proxy (Phase 6). Standalone app, linked from the portfolio. Stylized-realistic art.

## 2. Time model

| Setting | Value |
|---|---|
| Sim tick | 20 ticks / real second at 1× |
| Game time | 0.1 game min per tick → 1 real s = 2 game min; a 9:00–18:00 day ≈ 4.5 min |
| Night | Empty office → 2.5 game min per tick (a night ≈ 15 s) |
| Speeds | Pause, 1×, 2×, 4×, 8× (worker runs N ticks per frame) |
| Walking | 0.07 m per tick (1.4 m/s at 1×) |

## 3. Office (36 m × 24 m, origin at centre, +x east, +z south)

```
 N (windows)                                                      z=-12
 ┌───────────┬───────────┬──────────────────┬────────────────────┐
 │ SERVER    │ TEST LAB  │   DESIGN POD     │ CONFERENCE ROOM    │
 │ racks,SRE │ QA desks  │   4 desks        │ table, whiteboard  │
 ├──glass────┼──glass────┘                  ├door─glass──────────┤ z=-3
 │ KITCHEN   │  ENG POD 1   ENG POD 2   PRODUCT   [KANBAN] standup│
 │ coffee    │                                  ┌[LOBBY SCREEN]──┐│
 ├───────────┤        PING-PONG                 │ LOBBY reception││
 │ LOUNGE    │                                  └─── ENTRANCE ───┘│
 └──────────────────────── low cutaway wall ───────────────────────┘ z=+12
```

South/east exterior walls are 1 m (Sims cutaway). One layout module feeds both sim and renderer.

## 4. Team

| Agent | Role | Strength | Duty |
|---|---|---|---|
| Priya Sharma | Product Manager | product .95 | runs kickoff, approves design |
| Arjun Mehta | Business Analyst | product .85 | flows, requirements |
| Meera Iyer | UX Designer | design .95 | wireframes, hands off to FE |
| Kabir Rao | Visual Designer | design .90 | design system, mockups |
| Ananya Das | Tech Lead | backend .85 / frontend .75 | preferred reviewer, first paged |
| Rohan Verma | Frontend Engineer | frontend .90 | |
| Sara Khan | Frontend Engineer | frontend .85 | |
| Vikram Singh | Backend Engineer | backend .90 | |
| Neha Joshi | QA Engineer | qa .95 | tests, rejects buggy builds |
| Dev Patel | DevOps / SRE | ops .95 | CI/CD, deploy, on call |

Up to 4 contractors can be hired. Every agent: needs (energy, morale, focus), traits (speed,
quality), look, memory of last 8 moments.

## 5. Simulation

**Tick order:** commands → clock → scheduled events → routines (arrivals, standup, escalation) →
meeting update → per agent (needs → brain if idle → run plan step) → payroll / outage loss →
end checks.

**Plans** are short step lists: `goto`, `work`, `review`, `do` (timed activity + effect), `meet`,
`away`, `leave`. Short plans make agents re-decide often.

**Ticket flow**
- product / ops: doing → done
- design: doing → review (PM) → done → physical handoff to a frontend engineer
- frontend / backend: doing → peer review → QA → done
- launch: depends on everything; DevOps at the racks → deploy → celebration → score
- outage hotfix tickets (`fast`) skip review and QA

**Formulas**
```
rate     = skill × (0.5+0.5·focus) × (0.55+0.45·energy) × (0.75+0.25·morale) × speed
quality  = work-weighted mean of skill × (0.7+0.3·energy) × (0.85+0.15·morale) × qualityTrait
P(bug)   = clamp(1.3·(1−quality) − 0.05, 0.05, 0.6)   → 28 % rework, author morale −0.05
energy   −0.0011/min working (×1.6 overtime), +0.075/h at home; < 0.05 ⇒ burnout
```

**Utility brain** (top 3 shown in the inspector)

| Option | Score |
|---|---|
| burnout / go home | 3.0 / 2.0 |
| continue my ticket | 0.62 + 0.12·pressure + 0.10·focus |
| pick up ticket | 0.58 + 0.10·pressure + 0.3·fit |
| review / test | 0.66 (+0.10 lead) / 0.70 |
| pending handoff | 0.78 |
| coffee | 1.3·(1−energy)^1.6 |
| lunch (12:15–13:45) | 0.85 once a day |
| pizza | 0.80 |
| break | 1.1·(1−morale)^1.8 |
| idle | 0.20 |

**Navigation:** 0.5 m grid, A* (octile, no corner cutting), line-of-sight smoothing, exact end
points; walkers sidestep right when someone is ahead within 0.9 m.

**Meetings:** kickoff (conference room, whiteboard fills, tickets revealed), daily standup at
9:30 from Day 2 (Kanban circle), all-hands (player), fire drill (chaos), celebration (lobby screen).

## 6. Scenarios

1. **Startup MVP — Chai & Co.** landing page + ordering, deadline Day 2 17:00, 16 tickets.
2. **3 AM outage** — alarm, on-call SRE, player pages people; scored on downtime.
3. **Scope creep — PulseFit** — client call on Day 1 14:00 forces accept/negotiate decision.
4. **Crunch — Demo Day** — ~1.5× capacity; needs crunch, contractors or pizza.
5. **Free play** — typed brief → keyword ticket templates (AI PM in Phase 6).

## 7. Player actions

Assign ticket · pizza ($150) · all-hands · hire contractor ($500 + $110/h) · crunch mode ·
break / send home · page · chaos (fire drill, coffee machine broken, laptop dies, viral tweet) ·
decisions.

**Score /100:** on-time delivery 40 (else %done × 25), early 10, quality 20, budget 15, morale 15.
S ≥ 90, A ≥ 80, B ≥ 65, C ≥ 50, D, F = missed deadline.

## 8. Timeline

Only commands + their tick are recorded; snapshots every 300 ticks. Seek = restore nearest
snapshot and replay. Commands after a rewind truncate the old future (branching). Seed +
commands in the URL = shareable run.

## 9. Worker protocol

Page → worker: `init {scenario, seed, brief, speed}`, `cmd {cmd}`, `speed {value}`,
`pause {value}`, `seek {tick}`.
Worker → page (20 Hz): `frame {tick, maxTick, state, events}`. The page interpolates positions.

## 10. Rendering

- Furniture from primitives, merged per type → `InstancedMesh` (target < 60 draw calls).
- Characters: one `InstancedMesh` per body part shared by all agents; joints solved in JS.
- Procedural poses: walk, sit, type, stand, talk, drink, eat, present, celebrate, frustrated,
  ping-pong, tinker; smoothed per joint.
- Canvas-texture screens: Kanban mirrors tickets, whiteboard fills at kickoff, lobby screen shows
  progress then the shipped site, monitors scroll work and dim at night.
- Environment light + sun shadows driven by the clock, lights on at dusk, N8AO, selective-looking
  bloom via high threshold.
- FX: ping arcs, handoff documents, confetti, alarm pulses, pizza boxes, selection ring.
- Camera: damped orbit/pan/zoom, click agent to follow.

## 11. Phases

| # | Phase | Done when |
|---|---|---|
| 0 | Foundations | tests run, app boots |
| 1 | Office | screenshots from 3 angles, < 60 draw calls, 60 fps |
| 2 | People | no agent gets stuck (test); poses look right |
| 3 | Brains | MVP completes on its own; same seed ⇒ same run |
| 4 | Showing the work | the story is readable by watching |
| 5 | Game layer | every scenario winnable and losable; seek == linear run |
| 6 | Real AI | real brief → real site on the lobby screen |
| 7 | Polish | perf budget met, mobile fallback |

Balance targets: MVP untouched ≈ grade B, mid Day 2. Crunch untouched fails. Outage untouched ≈ 3 h down.
