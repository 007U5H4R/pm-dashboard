#!/usr/bin/env bash
# Replay a Stage-6 run against a project: three tickets, all four transition types, no human drags.
# Usage: simulate-stage6.sh <project-dir> <id1> <id2> <id3>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOVE="$HERE/move-ticket.sh"
PAUSE="${PAUSE:-2}"
[[ $# -eq 4 ]] || { echo "usage: $(basename "$0") <project-dir> <id1> <id2> <id3>" >&2; exit 1; }
DIR="$1"; A="$2"; B="$3"; C="$4"

step() { echo "▶ $1 → $2"; "$MOVE" "$DIR" "$1" "$2"; sleep "$PAUSE"; }

step "$A" "In Progress"
step "$A" "In Review"
step "$A" "Done"
step "$B" "In Progress"
step "$B" "In Review"
step "$B" "Done"
step "$C" "In Progress"
step "$C" "Blocked"
echo "✔ simulation complete: $A Done, $B Done, $C Blocked"
