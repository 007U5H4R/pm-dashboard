# Build & run (fork)

Prereq: `source .envrc.example` (Bun on the E Drive).

| Step | Command |
|---|---|
| Install | `bun install` |
| Lint / types / tests | `bun run check && bun run check:types && bun test` |
| Build binary | `bun scripts/build.ts` → `dist/backlog` |
| Run (single project) | `cd <project> && <fork>/dist/backlog browser --port 6421 --no-open` |
| Run (dashboard) | `cd <fork> && dist/backlog browser --projects ./projects.json --port 6421 --no-open` (after T5) |
| Dev loop | `bun run cli browser --port 6421 --no-open` |

Baseline on clean v1.51.0 (recorded 2026-09-06): a full `bun test` run measured **2836 pass / 20 fail / 8 skip** across 2864 tests in 286 files. Every failure is a pre-existing environment/upstream issue, not a fork change — see "Baseline & test gating" below. The deterministic environment-failure set is **18** (11 space-in-path + 7 TUI); the other 2 are load-sensitive flakes.

## Baseline & test gating

Bun pinned to 1.3.14. A full `bun test` in this environment produces ~18 deterministic failures that are pre-existing upstream/environment issues unrelated to fork changes — 11 from the space in the mounted volume name `/Volumes/E Drive` (unquoted paths in upstream test helpers; pass on CI) and 7 from a deterministic neo-neo-bblessed TUI global-screen bug in board-tui-move.test.ts (fails in isolation). The suite is also load-sensitive (a few timeout/global-state tests flip under load). Therefore tickets T2–T9 are gated per-file / changed-area in isolation (each ticket runs its own new and touched test files, which are deterministic), NOT on a green full suite.
