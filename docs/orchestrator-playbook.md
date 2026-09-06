# Stage-6 orchestrator ↔ board glue (pilot)

Run `<fork>/dist/backlog browser --projects ./projects.json --port 6421` for the duration of the build.
Every transition below is one command, run from anywhere (the helper `cd`s into the project):

| Orchestrator event | Command |
|---|---|
| Dispatch implementer subagent for ticket N | `scripts/orchestrator/move-ticket.sh <project-dir> <id> "In Progress"` |
| Implementer reports; entering review | `scripts/orchestrator/move-ticket.sh <project-dir> <id> "In Review"` |
| Two-stage review + AC validation passes | `scripts/orchestrator/move-ticket.sh <project-dir> <id> "Done"` |
| Fix loop fails / parked / blocked | `scripts/orchestrator/move-ticket.sh <project-dir> <id> "Blocked"` |

Equivalent raw command (run inside the project): `backlog task edit <id> -s "<status>"`.
MCP alternative: `backlog mcp start` inside the project and call the task-edit tool with `status`.

Exit codes: 0 moved · 1 bad arguments · 2 CLI failed · 3 status did not stick (unknown id).
No change to `~/dotfiles/claude/rules/build-workflow.md` until the family-tree pilot proves out.
