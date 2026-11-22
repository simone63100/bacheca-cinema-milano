#!/usr/bin/env bash
# Stop hook (project): typecheck + unit tests before Claude ends a turn.
# Exit 2 sends the failure back to Claude; a second consecutive stop is let through.
input=$(cat)
if printf '%s' "$input" | grep -q '"stop_hook_active": *true'; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! out=$(pnpm -s typecheck 2>&1); then printf 'typecheck rosso:\n%s\n' "$(printf '%s' "$out" | tail -20)" >&2; exit 2; fi
if ! out=$(pnpm -s test 2>&1); then printf 'test rossi:\n%s\n' "$(printf '%s' "$out" | grep -E 'FAIL|×|Expected|Received|Tests' | head -20)" >&2; exit 2; fi
exit 0
