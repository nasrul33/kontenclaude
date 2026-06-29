#!/usr/bin/env bash
# .claude/hooks/audit-log.sh
# PostToolUse: Catat semua Write/Edit oleh Claude ke audit log
# GAP FIX: pakai $CLAUDE_PROJECT_DIR untuk path absolut yang konsisten
# GAP FIX: log disimpan di PROJECT_ROOT/.claude/ bukan pwd/.claude/

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" ]] && exit 0
[[ "$TOOL" != "Write" && "$TOOL" != "Edit" && "$TOOL" != "MultiEdit" ]] && exit 0

# Gunakan CLAUDE_PROJECT_DIR jika tersedia, fallback ke git root
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="$PROJECT_ROOT/.claude"
LOG_FILE="$LOG_DIR/ai-edit-audit.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# Path relatif terhadap project root — lebih readable
RELATIVE_FILE="${FILE#$PROJECT_ROOT/}"
[[ "$RELATIVE_FILE" == "$FILE" ]] && RELATIVE_FILE="$FILE"  # fallback jika tidak ada prefix

printf '[%s] session=%s tool=%-10s file=%s\n' \
  "$TIMESTAMP" "${SESSION_ID:0:8}" "$TOOL" "$RELATIVE_FILE" >> "$LOG_FILE"

exit 0
