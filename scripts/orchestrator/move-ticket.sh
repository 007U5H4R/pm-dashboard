#!/usr/bin/env bash
# Move one Backlog.md ticket to a status, from any cwd, and fail loudly if it did not stick.
# Usage: move-ticket.sh <project-dir> <task-id> <status>
set -euo pipefail

FORK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKLOG_BIN="${BACKLOG_BIN:-$FORK_ROOT/dist/backlog}"
VALID_STATUSES=("To Do" "In Progress" "In Review" "Blocked" "Done")

usage() { echo "usage: $(basename "$0") <project-dir> <task-id> <\"To Do\"|\"In Progress\"|\"In Review\"|\"Blocked\"|\"Done\">" >&2; exit 1; }

[[ $# -eq 3 ]] || usage
PROJECT_DIR="$1"; TASK_ID="$2"; STATUS="$3"
[[ -d "$PROJECT_DIR/backlog" ]] || { echo "error: $PROJECT_DIR has no backlog/ folder" >&2; exit 1; }
[[ -x "$BACKLOG_BIN" ]] || { echo "error: backlog binary not found at $BACKLOG_BIN (build with: bun scripts/build.ts)" >&2; exit 1; }
valid=false; for s in "${VALID_STATUSES[@]}"; do [[ "$s" == "$STATUS" ]] && valid=true; done
$valid || { echo "error: invalid status '$STATUS'" >&2; usage; }

cd "$PROJECT_DIR"
if ! "$BACKLOG_BIN" task edit "$TASK_ID" -s "$STATUS" --plain >/dev/null; then
	echo "error: backlog task edit failed for $TASK_ID → '$STATUS' in $PROJECT_DIR" >&2
	exit 2
fi
if ! "$BACKLOG_BIN" task list --plain -s "$STATUS" | grep -qi -- "$TASK_ID"; then
	echo "error: $TASK_ID is not listed under '$STATUS' after the edit (task id unknown?)" >&2
	exit 3
fi
echo "✔ $TASK_ID → $STATUS ($PROJECT_DIR)"
