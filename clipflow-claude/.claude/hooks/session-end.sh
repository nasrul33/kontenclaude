#!/usr/bin/env bash
# .claude/hooks/session-end.sh
# Stop: Log ringkasan apa yang berubah di sesi ini

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_FILE="$PROJECT_ROOT/.claude/ai-edit-audit.log"

# Hitung berapa file yang diubah di sesi ini (dari audit log)
if [[ -f "$LOG_FILE" ]]; then
  TODAY=$(date -u +"%Y-%m-%d")
  COUNT=$(grep "$TODAY" "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')
  [[ "$COUNT" -gt "0" ]] && echo "Session summary: $COUNT file edits logged to .claude/ai-edit-audit.log"
fi

exit 0
