# AgentHQ Real — Plan for a team of AI agents that actually ships

Status: **plan only — nothing here is built yet.** Companion to `docs/PLAN.md` (the game).

## 1. Goal

Today AgentHQ *simulates* a software team: progress bars, dice-roll bugs, a drawn website.
AgentHQ Real makes the work real. You type a brief; Claude agents write a spec, open GitHub
issues, write code in a sandbox, open pull requests, review each other, run real tests, deploy
to Vercel, watch the live site and fix it when it breaks. The 3D office stops being the work
and becomes **the window onto the work**: every animation is driven by a real event.

**Done when (end of R4):** a brief like *"a landing page with a waitlist for a pottery shop
called Mitti"* becomes a public URL — built only through real PRs that passed CI, review and
QA — with uptime monitoring, and the CEO approved both the plan and the production release.
**Then (R5):** a real fault on staging is detected, rolled back and fixed by the agents.

### What stays
- The game (scripted brains, scenarios, rewind) remains as **Demo mode** — offline, free,
  no key. It is the portfolio piece and the fallback.
- The 3D office, characters, inspector, Kanban, feed and HUD are reused for **Live mode**.

### Honest limits (shown in the UI, not hidden)
- Scope for v1: static sites and small web apps without user accounts. Bigger apps will stall
  and ask the CEO for help — that's a feature (escalation), not a failure to hide.
- Real work takes real time: a project is minutes to a few hours, not 4 game-minutes a day.
- Every run costs real money. Budgets are hard caps (§11).

## 2. Principles

1. **Real artifacts only.** If the office shows "PR opened", a PR exists and the feed links it.
2. **The office never invents work.** Agents may idle realistically (coffee, chat) between jobs,
   but anything work-related on screen maps 1:1 to an event in the event log.
3. **Humans hold the dangerous buttons.** Approving the plan, releasing to production and raising
   the budget are CEO-only actions in the UI — never tools an agent can call.
4. **Least privilege.** Agents never see the Anthropic key, the Vercel token or a long-lived
   GitHub token. Code runs only in sandboxes.
5. **Everything is an event.** One append-only event log per project powers the live office,
   the feed, replay ("watch how it was built") and debugging.
6. **Demo mode keeps working without a key**, as today.

## 3. Architecture

```
 Browser (existing app)                      Orchestrator (new, Node, long-running)
 ┌──────────────────────────┐  WebSocket    ┌───────────────────────────────────────┐
 │ 3D office · Kanban · HUD │◄── events ────│ Event log (SQLite) ──► broadcast      │
 │ Inspector · CEO controls │─── commands ─►│ Project state machine (§4)            │
 │ src/live/LiveClient      │               │ Job queue + scheduler + budgets       │
 └──────────────────────────┘               │ Agent roles: prompts + tools (§5)     │
                                            │ AgentRuntime ─┬─ ManagedRuntime       │
                                            │               ├─ SdkDockerRuntime     │
                                            │               └─ FakeRuntime (tests)  │
                                            │ Integrations: GitHub App · Vercel ·   │
                                            │               Monitor                 │
                                            └───────┬──────────────┬────────────────┘
                                                    │              │
                               Claude sandboxes ◄───┘              └──► GitHub (repo, issues,
                               (code, shell, tests)                     PRs, Actions CI)
                                                                        Vercel (preview + prod)
```

- **Why a separate server:** agents run for minutes to hours and must keep going when the tab is
  closed. The browser and the existing `/api/agent` proxy can't do that; Vercel serverless
  functions time out. The orchestrator is a normal Node process (local first, hosted later).
- **Why SQLite:** one file, zero setup, enough for one CEO and a handful of projects
  (`better-sqlite3`). Swap for Postgres only if this becomes multi-user (R6).
- **CI and QA run in GitHub Actions**, not on your laptop: free runners, and your machine's
  memory stays free (it has been running low).

### Agent runtime — the key technical choice

Both options are real and documented; the orchestrator talks to an `AgentRuntime` interface so
either can be used (and a `FakeRuntime` replays recorded sessions in tests).

| | **Managed Agents** (recommended for v1) | **Agent SDK + Docker** |
|---|---|---|
| What | Anthropic hosts the agent loop and a sandbox (microVM: filesystem, bash, network off by default with an allowlist) | `@anthropic-ai/claude-agent-sdk` `query()` runs the agent on *your* machine; you must containerise it |
| Status | Public beta (`managed-agents-2026-04-01` header) | Generally available |
| Your machine needs | Just Node | Docker + RAM per concurrent agent |
| Events | Server-sent events per session | Async stream of typed messages from `query()` |
| Cost | Model usage + per-hour charge for running sessions (check current pricing) | Model usage + your own compute |
| Risk | Beta: API may change | Sandboxing is your responsibility |

**Recommendation:** Managed Agents for v1, because this laptop is short on memory and sandboxing
is the hardest thing to get right yourself. Keep `SdkDockerRuntime` as the escape hatch if the
beta changes or self-hosting becomes cheaper.
Docs: platform.claude.com/docs/en/managed-agents/quickstart · code.claude.com/docs/en/agent-sdk/overview

### Models (configurable per role)

| Use | Default | Why |
|---|---|---|
| Engineers, designer, PM | Claude Sonnet 5.5 | Strong coding at a moderate price |
| Tech lead review on risky PRs, incidents, retries after 2 failures | Claude Opus 5.5 | Escalate only when it matters |
| Summaries for the feed, office speech bubbles, CEO chat, log triage | Claude Haiku 4.5 | Cheap and fast |

Long agent loops use prompt caching (stable system prompt + repo map first), per-job turn caps
and `max_tokens` (§11).

## 4. Project lifecycle

A project is a state machine stored in SQLite; every transition is an event.

```
brief ─► discovery ─► plan_review ══CEO approves══► building ─► staging ─► release_review
                         │  (CEO edits/rejects)        ▲  │                    │
                         ▼                             │  ▼                    ║ CEO approves
                      discovery                     QA bugs, review          production
                                                    changes                    │
                                                                               ▼
                                                              monitoring ◄──► incident (§8)
```

| Stage | Who | Real output |
|---|---|---|
| discovery | PM agent | `docs/SPEC.md` in the repo: goals, pages, user flows, acceptance criteria. May ask the CEO up to 3 questions (decision modal). |
| plan_review | **CEO** | Approves / edits the ticket list (shown on the Kanban before any code is written). |
| building | Designer, engineers, reviewer, QA | Issues → branches → PRs → CI → review → merge, ticket by ticket (§6). |
| staging | DevOps | `main` is deployed to a staging (Vercel preview) URL; QA runs the full suite there. |
| release_review | **CEO** | Sees the staging URL live on the lobby screen + QA report; approves the release. |
| production | DevOps | Promotes to production. Celebration in the office — because it really happened. |
| monitoring | Orchestrator + DevOps | Health checks, synthetic tests, error logs (§8). |

## 5. The team

Same ten characters; each role is a system prompt + an allowed tool set + model + limits.
Agents get **orchestrator tools** (implemented by our server, so secrets stay server-side) on
top of the runtime's file/bash tools inside their sandbox.

| Role | Character | Does | Orchestrator tools |
|---|---|---|---|
| PM | Priya | Spec, tickets with acceptance criteria, answers "what did the client mean" | `write_spec`, `create_ticket`, `ask_ceo` |
| Analyst | Arjun | Copy, content, SEO/meta, checks the build against the spec | `comment`, `create_ticket` |
| UX / visual design | Meera, Kabir | Design tokens (`tokens.css`), page layouts as static HTML mockups committed to `design/` | `submit_for_review`, `report_progress` |
| Engineers | Rohan, Sara, Vikram (+ contractors = more parallel jobs) | Implement a ticket on its branch, run build/tests in the sandbox, open the PR | `report_progress`, `open_pr`, `ask_teammate` |
| Tech lead | Ananya | Reviews PRs (real diff), requests changes or approves; resolves merge conflicts | `submit_review`, `merge_pr` (only when CI is green) |
| QA | Neha | Writes Playwright tests from acceptance criteria; reads CI results on preview URLs; files bugs with steps + screenshot | `file_bug`, `pass_ticket` |
| DevOps | Dev | Repo + CI setup, staging, production promotion (after CEO approval), monitoring, incidents | `read_deploys`, `read_logs`, `rollback`, `open_incident` |

**Rules the orchestrator enforces (not the prompts):**
- A ticket's job gets only that ticket, the spec, the design tokens and a repo map — not the
  whole chat history. Keeps context small and cost down.
- Nobody pushes to `main`. Merges happen through `merge_pr`, which checks CI + one approving
  review.
- `report_progress(percent, note)` is what moves the Kanban progress bar — real, agent-reported.
- Bounce limit: a ticket rejected by review/QA 3 times escalates to the CEO with a summary.
- `ask_ceo` pauses only that ticket; the rest of the team keeps working.

## 6. How work flows (one ticket)

1. PM ticket → **GitHub issue** (title, acceptance criteria, labels for type/priority).
2. Scheduler picks the best free agent (reuse today's `ticketFit` idea: skill × availability).
3. Job starts: sandbox clones the repo with a **short-lived, single-repo token** from a GitHub
   App, creates branch `t/105-cart-page`.
4. Agent codes, runs `npm run build` / tests inside the sandbox, calls `report_progress`.
5. `open_pr` → orchestrator opens the PR, links the issue. **GitHub Actions** runs lint, unit
   tests, build; Vercel builds a **preview URL** for the PR.
6. QA job runs Playwright against the preview URL (in Actions). Fail → `file_bug` creates a
   linked issue and the ticket bounces to its author (fast lane: no re-review if the diff is small).
7. Tech-lead job reviews the diff. Changes requested → back to the author with the comments.
8. Green CI + approved review → `merge_pr`. Ticket done; dependents unblock.

Parallelism: 1 job per agent; default max 3 concurrent jobs (budget knob). Contractors =
extra concurrency, billed against the real budget.

### What the agents build on

A fixed **starter template** (a GitHub template repo we own) massively raises success rates:
Next.js (App Router) + TypeScript + Tailwind, Playwright and Vitest preconfigured, CI workflow,
`/api/health`, a tiny error beacon, `noindex` on previews, a `CHAOS` env flag for drills (§8).
v1 supports this one stack. A database (e.g. Postgres via the Vercel marketplace) is R6.

## 7. Live office — events in, animations out

### Event envelope (shared/events.js, used by server and browser)

```js
{ id, projectId, ts, kind, agent?, ticket?, data }
```

| Kind | Example data | Office |
|---|---|---|
| `job.started` / `job.finished` | role, ticket, model | agent walks to desk / stands, stretches |
| `agent.activity` | `editing app/page.tsx`, `running tests` (throttled ≤1/5 s per agent) | typing; monitor shows the real file name; speech bubble from Haiku summary |
| `progress` | percent, note | Kanban bar moves |
| `pr.opened` / `review.requested` | url | ping arc author → reviewer |
| `review.changes` / `review.approved` | comments count | frustrated / thumbs-up |
| `ci.started` / `ci.failed` / `ci.passed` | check names | QA lab screens; red/green on the Kanban card |
| `bug.filed` | issue url | QA bounce arc |
| `deploy.preview` / `deploy.production` | url | DevOps to the racks; lobby screen shows the **real site** (screenshot or iframe overlay) |
| `ask.ceo` / `approval.needed` | question, options | phone rings; decision modal (reused) |
| `alert.fired` / `incident.*` / `alert.resolved` | check, status, logs | alarm lights (reused), DevOps paged |
| `budget.spent` | dollars, tokens | HUD budget is now **real money** |

### How the existing code is reused
- `src/live/LiveClient.js` replaces `SimClient` in Live mode (same `onFrame` interface).
- The sim keeps running in the worker in **Live mode**: game clock = wall clock, no speed-ups.
  Each incoming event becomes a recorded command (`live`), and a new pure brain
  (`sim/brains/live.js`) reads "agent X has a running job on ticket Y" from `S` and plays the
  matching routine; when an agent has no job it falls back to the scripted idle life.
  CLAUDE.md rules still hold: sim stays pure, events enter as commands.
- **Replay of a real project:** the event log fed through the same pipeline at 8× — "watch how
  Mitti was built" — rewind works exactly as today.
- Feed items, inspector memory and Kanban cards gain **links** to the real issue/PR/deploy.

## 8. Production, monitoring, incidents

**Monitoring (orchestrator):**
- Uptime check on the production URL every 60 s (`/api/health` + homepage status/latency).
- Synthetic Playwright smoke test every 15 min (scheduled GitHub Actions workflow).
- Error beacon + Vercel runtime logs polled via the Vercel API.
- Alert = 3 consecutive failures, or error rate above threshold.

**Incident loop:**
1. `alert.fired` → alarm in the office, toast, optional browser notification.
2. Policy (CEO setting): **auto-rollback** to the last healthy deployment (Vercel instant
   rollback) — restore service first, like a real SRE.
3. DevOps agent job (Opus) gets the alert, logs, recent deploy diff → writes a hotfix ticket
   (fast lane: CI + review, QA after).
4. Fix deployed → health checks green for 10 min → `alert.resolved`.
5. Agent writes `docs/incidents/YYYY-MM-DD.md` (timeline, cause, fix) — shown in the feed.

**Drills (R5):** the CEO can break **staging only**: the orchestrator sets `CHAOS=500` (or
`slow`, `broken-asset`) on a staging deployment; the team must detect and fix it. Production is
never deliberately broken.

## 9. The CEO (you)

| Control | Effect |
|---|---|
| Brief + optional questions round | Starts discovery |
| Approve / edit plan | Gate before any code |
| Message an agent | Real effect: added as an instruction to their current/next job |
| Answer `ask_ceo` | Unblocks that ticket |
| Pause / resume project | Stops scheduling new jobs; running jobs finish |
| Approve release | Gate before production |
| Budget cap, max concurrency, auto-rollback | Settings per project |
| Hire contractor | +1 concurrent engineer job (real cost) |

## 10. Security

- **Sandboxes only.** Agent code and commands never run on the orchestrator host. Network
  allowlist: npm registry, GitHub, the project's preview URLs. Nothing else.
- **GitHub App**, installed only on the projects org/account: installation tokens expire in an
  hour and are scoped to one repo. Agents can't touch your other repos.
- **Vercel** deploys via its GitHub integration; the Vercel token lives only in the orchestrator
  (read deployments, rollback, set staging env).
- **Anthropic key** only in the orchestrator's environment.
- **Prompt injection:** repo content, issue text, logs and web pages are untrusted input.
  Dangerous actions (merge to main, production, budget) are enforced by the orchestrator, not
  by prompts; production and budget need the CEO.
- **Dashboard auth** before it's hosted anywhere public (R6). Locally the orchestrator binds
  to `127.0.0.1` only.
- Generated sites are public on release: the CEO approval gate is also the content gate;
  previews are `noindex`.

## 11. Cost control

- **Hard project budget** (default set by you, e.g. $10–20 for a first project); at 80% the CEO
  gets a warning, at 100% scheduling stops and the CEO decides.
- Spend is computed from the usage numbers every API response returns × a price table in config
  (+ sandbox hours). Shown live in the HUD and per agent in the inspector.
- Per job: max turns, max wall-clock time (30 min), `max_tokens`; failed jobs retry once, then
  escalate (no infinite loops).
- Small contexts per ticket (§5), prompt caching for stable prefixes, Haiku for chatter.
- R1 measures what a real project actually costs before the budget defaults are set — no
  guessed numbers in the UI.

## 12. Reliability

- Jobs: `queued → running → succeeded | failed | needs_ceo`, persisted; the orchestrator can
  restart and resume (runtime sessions are resumable; otherwise the job restarts from its branch).
- Idempotent integrations (re-opening a PR finds the existing one).
- Stuck-job watchdog (no events for 5 min → cancel + retry/escalate).
- GitHub/Vercel/Anthropic outages → project pauses with a clear status, never silent failure.

## 13. Folder layout (additions)

```
orchestrator/
  src/
    server.js            HTTP + WebSocket (127.0.0.1)
    db/                  schema + migrations (better-sqlite3)
    projects/            lifecycle state machine
    jobs/                queue, scheduler, budgets, watchdog
    agents/              one file per role: prompt, tools, model, limits
    tools/               orchestrator tools (create_ticket, open_pr, ask_ceo…)
    runtime/             AgentRuntime: managed.js · sdkDocker.js · fake.js
    integrations/        github.js (App) · vercel.js · monitor.js
    events/              log + broadcast
  tests/                 unit + recorded-session tests (no network)
shared/events.js         event schema (server + browser)
templates/next-starter/  source of the GitHub template repo
src/live/                LiveClient, event → command adapter, live UI bits
src/sim/brains/live.js   presentation brain for Live mode
```

## 14. Build phases

Each phase ends with something you can see working. Sizes are relative (S/M/L), not promises.

| # | Phase | Done when | Size |
|---|---|---|---|
| R0 | **Foundations** — orchestrator skeleton, SQLite, event log, WebSocket, Live mode toggle, `FakeRuntime` emitting scripted events | The 3D office is driven entirely by events from the server (fake ones) | M |
| R1 | **One agent ships** — GitHub App, template repo, one engineer agent in a real sandbox, Vercel deploy | A brief becomes a real public URL on the lobby screen; real cost of the run measured | L |
| R2 | **Team workflow** — PM spec + issues, CEO plan approval, branch/PR per ticket, CI, tech-lead review, merge rules, scheduler with parallel jobs | A 6–10 ticket project merges only through reviewed, green PRs | L |
| R3 | **Design + QA** — tokens/mockups, Playwright from acceptance criteria, bug bounces, bounce-limit escalation | QA catches a real bug and the author fixes it | M |
| R4 | **Production + monitoring** — staging, release approval, prod promotion, uptime/synthetic/error monitoring, live budget HUD | The §1 "done when" holds end to end | M |
| R5 | **Incidents** — alerts in the office, auto-rollback, DevOps fix loop, incident reports, staging drills | A staging drill is detected, rolled back and fixed without you | M |
| R6 | **Hardening + hosting** — dashboard auth, multiple projects, replay of real projects, cost reports, deploy the orchestrator (any Node host with persistent disk) | You can share a link that shows a real project being built | M |

## 15. Testing

- **Unit tests** for the state machine, scheduler, budgets, tools — no network.
- **Recorded sessions:** `FakeRuntime` replays saved event streams, so the full pipeline (and the
  3D office) is tested without spending money.
- **Integration adapters** tested against recorded GitHub/Vercel responses.
- **Sandbox account E2E:** a dedicated GitHub org + Vercel team, a fixed canary brief run on
  demand (and later nightly with a tiny budget).
- Existing game tests keep passing — Demo mode must never regress.

## 16. Decisions needed from you before R0/R1

| Decision | My recommendation |
|---|---|
| Agent runtime | Managed Agents (beta), with the Agent SDK + Docker as fallback |
| Accounts | A **separate GitHub org** (e.g. `agenthq-builds`) and a Vercel team just for agent projects |
| Repos public or private | Private during building, public optional on release |
| First project budget | $10–20 hard cap until R1 measures real costs |
| Where the orchestrator runs | Your laptop for R0–R5; a small Node host in R6 |
| Generated stack | Next.js + Tailwind template only, for v1 |
| Auto-rollback default | On |

## 17. Risks

| Risk | Mitigation |
|---|---|
| Agents produce code that doesn't build | Template, small tickets, build/test inside the sandbox before PR, bounce limit, Opus retry |
| Merge conflicts between parallel agents | Ticket dependencies from the spec, small PRs, tech lead resolves, max 3 parallel |
| Costs creep | Hard caps, per-job limits, measured defaults, live spend in the HUD |
| Managed Agents beta changes | `AgentRuntime` interface + SDK/Docker fallback |
| Prompt injection via issues/logs/web | Server-enforced permissions; CEO-only dangerous actions |
| The office looks idle during long jobs | Activity events (file names, test runs), idle routines, replay at 8× |
| Your laptop's memory | Heavy work runs in Anthropic sandboxes and GitHub Actions, not locally |
