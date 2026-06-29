#!/usr/bin/env bash
# .claude/hooks/format-ts.sh
# PostToolUse: Auto-format TS/JS/JSON/CSS/MD setelah edit
# GAP FIX: pakai --yes bukan --no-install (valid di npm 10+)
# GAP FIX: pakai $CLAUDE_PROJECT_DIR agar path absolut, bukan pwd-dependent

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" || ! -f "$FILE" ]] && exit 0

# Hanya format file yang relevan
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    ;;
  *)
    exit 0
    ;;
esac

# Gunakan prettier dari project root — lebih reliable daripada npx
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PRETTIER="$PROJECT_ROOT/node_modules/.bin/prettier"

if [[ -x "$PRETTIER" ]]; then
  "$PRETTIER" --write "$FILE" 2>/dev/null
elif command -v prettier >/dev/null 2>&1; then
  prettier --write "$FILE" 2>/dev/null
fi
# Jika prettier tidak ada, skip — jangan error

exit 0
