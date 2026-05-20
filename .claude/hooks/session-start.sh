#!/bin/bash
# Surface TODO.md to Claude at the start of every session.
#
# Output schema: a single JSON line with hookSpecificOutput.additionalContext.
# Claude Code injects that string into the session as system context, so the
# assistant sees the current TODO list before its first reply.
#
# Sync execution (no `async: true`) — the body is tiny (one file read), so
# the startup cost is negligible and we guarantee the TODO content reaches
# the model before any user prompt is processed.
set -euo pipefail

TODO_PATH="${CLAUDE_PROJECT_DIR:-$(pwd)}/TODO.md"

if [ ! -f "$TODO_PATH" ]; then
  # No TODO file — emit empty context rather than failing the session start.
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":""}}\n'
  exit 0
fi

# Use python for safe JSON escaping of the TODO body (handles quotes,
# newlines, Unicode, etc. — Korean text in TODO.md would break a naive
# shell escape).
python3 - "$TODO_PATH" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    body = f.read()
context = (
    "Pending TODO list for this repo (from TODO.md at repo root). "
    "Treat this as outstanding work the owner hasn't checked off yet. "
    "When you complete an item, EDIT TODO.md in the same PR to remove "
    "or move it so the next session doesn't keep reminding about it.\n\n"
    + body
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context,
    }
}))
PY
