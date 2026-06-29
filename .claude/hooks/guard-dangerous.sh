#!/usr/bin/env bash
# .claude/hooks/guard-dangerous.sh
# PreToolUse: Blokir operasi berbahaya sebelum dieksekusi
# Exit code 2 = BLOKIR; Exit code 0 = IZINKAN
# GAP FIX: baca INPUT sekali ke variabel, lalu parse — hindari pipe yang habis

INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
CMD=$(echo "$INPUT"  | jq -r '.tool_input.command // empty')
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# ── 1. Guard Bash: perintah destruktif ───────────────────────────────────────
if [[ "$TOOL" == "Bash" ]]; then
  DANGEROUS_PATTERNS=(
    "DROP TABLE"
    "DROP DATABASE"
    "TRUNCATE "
    "prisma migrate reset"
    "prisma db push --force-reset"
    "rm -rf.*minio"
    "rm -rf.*data/postgres"
    "rm -rf.*packages/db/prisma/migrations"
    "rm -rf.*generated"
    "docker system prune"
  )
  for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if echo "$CMD" | grep -qi "$pattern"; then
      echo "BLOCKED: Perintah berbahaya '$pattern' tidak diizinkan oleh ClipFlow guard." >&2
      echo "Jika memang diperlukan, lakukan MANUAL di terminal — bukan via Claude." >&2
      exit 2
    fi
  done
fi

# ── 2. Guard: jangan edit migration yang sudah di-commit ─────────────────────
if [[ "$TOOL" == "Edit" || "$TOOL" == "Write" || "$TOOL" == "MultiEdit" ]]; then
  if echo "$FILE" | grep -qE "prisma/migrations/.*\.sql$"; then
    # Cari project root via git
    FILE_DIR=$(dirname "$FILE")
    GIT_ROOT=$(git -C "$FILE_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")
    if [[ -n "$GIT_ROOT" ]]; then
      REL_FILE="${FILE#$GIT_ROOT/}"
      if git -C "$GIT_ROOT" ls-files --error-unmatch "$REL_FILE" 2>/dev/null; then
        echo "BLOCKED: '$FILE' adalah migration yang sudah di-commit." >&2
        echo "Buat migration baru via: pnpm db:migrate" >&2
        exit 2
      fi
    fi
  fi
fi

# ── 3. Guard: jangan write ke file Prisma generated ──────────────────────────
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" || "$TOOL" == "MultiEdit" ]]; then
  if echo "$FILE" | grep -qE "packages/db/generated/"; then
    echo "BLOCKED: Jangan edit Prisma generated files secara manual." >&2
    echo "Jalankan: pnpm db:generate" >&2
    exit 2
  fi
fi

# ── 4. Guard: jangan baca .env file yang berisi secret ───────────────────────
if [[ "$TOOL" == "Read" ]]; then
  if echo "$FILE" | grep -qE "(^|/)\.env(\.production|\.staging|\.local)?$"; then
    echo "BLOCKED: Jangan baca file .env yang berisi secret." >&2
    echo "Gunakan process.env atau lihat .env.example untuk referensi." >&2
    exit 2
  fi
fi

# ── 5. Guard: blokir deploy/publish ke production ────────────────────────────
if [[ "$TOOL" == "Bash" ]]; then
  if echo "$CMD" | grep -qiE "(docker.*push|npm.*publish|pnpm.*publish|fly.*deploy|kubectl.*apply)"; then
    echo "BLOCKED: Deploy ke production harus dilakukan MANUAL untuk keamanan." >&2
    exit 2
  fi
fi

exit 0
