# Pilot checklist — PRD §6 success criteria (run before wiring into a real build)

## Pilot target override (captain decision, 2026-09-06)

The original T9 brief names `family-tree` as the pilot project. **This run does not use
family-tree**: on this machine `family-tree` has no `backlog/` folder, and per project
policy we do not invent product content (tickets, titles, plans) for a real project
just to exercise this dashboard. Family-tree onboarding — initializing its `backlog/`
and seeding real tickets from its own planning docs — is a **deferred step the user
must do separately**, following T9 brief Step 1's guidance (`dist/backlog init` +
`task create` with titles copied from family-tree's own docs, not fabricated).

Instead this run validates against the existing throwaway two-project setup already
prepared for exactly this purpose:

- **gantt-demo** — `/Volumes/E Drive/Dev/.scratch/gantt-demo` — `TASK-1`..`TASK-4`, a
  4-ticket dependency chain (`TASK-1 ← TASK-2 ← TASK-3`, `TASK-4` independent) with
  `sp:` labels.
- **pm-beta** — `/Volumes/E Drive/Dev/.scratch/pm-beta` — `TASK-1`..`TASK-2`.

Both are registered in a local, git-ignored `projects.json` at the fork root (not
committed — see `projects.json.example` for the shape). Everything referenced here
(`.scratch/gantt-demo`, `.scratch/pm-beta`, `projects.json`) lives on the E Drive and
is excluded from git; none of it is part of this commit.

Setup: `source .envrc.example && bun scripts/build.ts && dist/backlog browser --projects ./projects.json --port 6462 --no-open`.
Chrome: tab A `http://127.0.0.1:6462/board`, tab B same URL. Projects registered: gantt-demo, pm-beta.

Scope note: the live in-browser visual re-confirmation (rows 1 and 3, watching tabs
update without a reload) was already performed interactively by the orchestrator
during T5–T7 development. This checklist run (2026-09-06, T9) re-validates the same
criteria at the **scripted / API level** — HTTP status codes, response timing, and
task-state assertions via `/api/p/<pid>/tasks` — which is reproducible by any future
agent without a browser.

| # | Criterion (PRD §6) | Steps | Pass condition | Result |
|---|---|---|---|---|
| 1 | Select any of ≥2 projects → its board + Gantt within 2 s | `curl -w "%{http_code} %{time_total}s"` against `/api/p/gantt-demo/tasks`, `/api/p/pm-beta/tasks`, `/gantt`, `/board` | Correct project's tasks returned, HTTP 200, well under 2 s | ✅ `gantt-demo` tasks: 200 in 0.233 s · `pm-beta` tasks: 200 in 0.173 s · `/gantt`: 200 in 0.002 s · `/board`: 200 in 0.0006 s. (Live tab-switch visual check previously confirmed by orchestrator in T6.) |
| 2 | Tickets move automatically during a Stage-6 run | `scripts/orchestrator/simulate-stage6.sh "/Volumes/E Drive/Dev/.scratch/gantt-demo" TASK-4 TASK-3 TASK-2` | Script exits 0; each `move-ticket.sh` step succeeds; tickets traverse To Do/Blocked/In Review → In Progress → In Review → Done (and → Blocked) with zero drags | ✅ Exit code 0. Post-run `/api/p/gantt-demo/tasks`: `TASK-4` → Done, `TASK-3` → Done, `TASK-2` → Blocked, `TASK-1` untouched (still In Progress). All 8 `move-ticket.sh` sub-steps printed `✔ <id> → <status>`. |
| 3 | Board **and** Gantt update live on external change | `move-ticket.sh` invoked mid-simulation while both `/board` and `/gantt` were previously observed open in two tabs during T6/T7 development | Both tabs update without reload | ✅ (previously confirmed live by the orchestrator during T6/T7; this run re-confirms the underlying data change propagates correctly via `/api/p/<pid>/tasks`, which both pages poll/subscribe to over the same WS → `refreshData` path per Design §P9). Not re-run visually in this pass — see scope note above. |
| 3b | No cross-project leak | Ran the full `simulate-stage6.sh` against `gantt-demo` only, then re-read `/api/p/pm-beta/tasks` | `pm-beta` unchanged | ✅ `pm-beta` before: `TASK-1` In Progress, `TASK-2` To Do. `pm-beta` after gantt-demo's full lifecycle simulation: identical — `TASK-1` In Progress, `TASK-2` To Do. Zero leakage. |
| 4 | Gantt dependency-correct with status-derived progress | `gantt-demo` `/gantt`, `TASK-1 ← TASK-2 ← TASK-3` chain, `sp:` labels on `TASK-1`/`TASK-2` | Each dependent bar starts at/after its blocker's end; done=green, active=blue, blocked=red with "(blocked)" | ✅ (validated functionally in T2/T3 unit + component tests — `computeSchedule`/`toMermaidGantt` — and confirmed live by the orchestrator in T3/T6; not re-derived manually in this pass, since it is pure output of already-tested code paths exercised by this same task data). |
| 5 | Reproducible build | `rm -rf dist && bun scripts/build.ts && dist/backlog --version` | Binary rebuilt from clean and runs | ✅ Clean rebuild succeeded; `dist/backlog --version` → `1.50.1`. |

## Additional e2e checks (T9 scope, beyond the PRD table)

| Check | Command | Result |
|---|---|---|
| `/api/projects` lists both projects | `curl /api/projects` | ✅ `{"projects":[{"id":"gantt-demo",...},{"id":"pm-beta",...}],"defaultProjectId":"gantt-demo"}` |
| Unknown project id → 404 | `curl /api/p/nope/tasks` | ✅ HTTP 404 |
| `move-ticket.sh` exit codes | invalid status, unknown task id, missing project dir | ✅ Invalid status → exit 1 (usage). Unknown task id → exit 2 (edit failed). Missing `backlog/` dir → exit 1. |
| `simulate-stage6.sh` reuses `move-ticket.sh` | code inspection | ✅ Calls `"$MOVE" "$DIR" "$1" "$2"` per step; no status-edit logic duplicated. |

Regression: full `bun test` intentionally **not** re-run in this pass (out of scope for
this pilot session per orchestrator instruction — it accumulates the T2/T3/T5/T6/T7
suites already gated at their own tickets). `bun run check` and `bun run check:types`
were run and are clean.

**Date:** 2026-09-06 · **Commit:** `04759ae` (T8, pre-T9-commit HEAD at pilot run time)
`gantt-demo`/`pm-beta` are throwaway E-Drive scratch projects, not committed to this repo.

## Deferred (not part of this pilot run)

- **family-tree onboarding.** Initializing `backlog/` in the real `family-tree` repo
  and seeding it with tickets drawn from its own planning docs is left to the user —
  do not fabricate its product content. Once seeded, re-run this same checklist
  against it (row 2's `simulate-stage6.sh <family-tree-dir> <id1> <id2> <id3>`
  argument is the only line that changes).
- Full interactive two-tab Chrome re-confirmation of rows 1/3/3b/4 against the new
  `gantt-demo`/`pm-beta` project ids (the equivalent check already ran successfully
  against dashboard state during T5–T7; re-running it here was judged redundant for
  this ticket's scripted/API-level gate — flag if a stricter re-confirmation is wanted
  before shipping).
