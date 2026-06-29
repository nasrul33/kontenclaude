#!/usr/bin/env bash
# .claude/hooks/typecheck.sh
# PostToolUse: Jalankan tsc setelah file TypeScript diubah
# GAP FIX: jalankan tsc dari apps/api/ bukan root monorepo
# GAP FIX: cek keberadaan tsconfig.json sebelum tsc
# GAP FIX: gunakan $CLAUDE_PROJECT_DIR untuk path yang konsisten

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" ]] && exit 0

# Hanya jalankan untuk file TypeScript
case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip file test, generated, dan node_modules
if echo "$FILE" | grep -qE "(\.test\.|\.spec\.|/generated/|/node_modules/|\.d\.ts$)"; then
  exit 0
fi

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Tentukan tsconfig yang tepat berdasarkan lokasi file
if echo "$FILE" | grep -q "apps/api/"; then
  TSC_DIR="$PROJECT_ROOT/apps/api"
elif echo "$FILE" | grep -q "apps/web/"; then
  TSC_DIR="$PROJECT_ROOT/apps/web"
elif echo "$FILE" | grep -q "packages/"; then
  # Cari tsconfig di package yang relevan
  PKG_DIR=$(echo "$FILE" | grep -oE "packages/[^/]+")
  TSC_DIR="$PROJECT_ROOT/$PKG_DIR"
else
  TSC_DIR="$PROJECT_ROOT"
fi

# Pastikan tsconfig.json ada
if [[ ! -f "$TSC_DIR/tsconfig.json" ]]; then
  exit 0  # Tidak ada tsconfig, skip — jangan error
fi

# Cek npx tersedia
command -v npx >/dev/null 2>&1 || exit 0

OUTPUT=$(cd "$TSC_DIR" && npx --yes tsc --noEmit --skipLibCheck 2>&1 | head -25)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "TypeScript errors in $TSC_DIR after editing $(basename "$FILE"):"
  echo "$OUTPUT"
fi

# Exit 0 — informasikan saja, jangan blokir
exit 0
