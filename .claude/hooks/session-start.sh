#!/usr/bin/env bash
# .claude/hooks/session-start.sh
# SessionStart: Inject konteks penting saat sesi Claude baru dimulai
# Menampilkan status Docker Compose dan git status ringkas

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "=== ClipFlow Session Start ==="
echo "Project: $PROJECT_ROOT"
echo "Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Git status ringkas
if git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null)
  CHANGED=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "Git: branch=$BRANCH, changed_files=$CHANGED"
fi

# Docker status ringkas (non-blocking)
if command -v docker >/dev/null 2>&1; then
  RUNNING=$(docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" ps --services --status running 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  [[ -n "$RUNNING" ]] && echo "Docker running: $RUNNING"
fi

echo "=== Invariants active — see CLAUDE.md ==="
exit 0
