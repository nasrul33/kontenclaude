# ClipFlow — AGENTS.md

This file provides context for AI agents (Claude Code, Copilot, Cursor, etc.)
working on the ClipFlow codebase. It supplements CLAUDE.md with agent-specific
instructions.

## Quick Start for Agents

```bash
# 1. Install dependencies
pnpm install

# 2. Start services
docker compose -f infra/docker-compose.yml up -d

# 3. Run migrations
pnpm db:migrate

# 4. Start dev
pnpm dev
```

## Critical Rules (Never Break)

1. **No plaintext tokens** — all OAuth tokens encrypted AES-256-GCM before DB
2. **FFmpeg via execa()** — never `exec()` or `shell: true`
3. **Prisma 7 imports** — from `'../../../packages/db/generated'` not `@prisma/client`
4. **BullMQ idempotency** — jobId = sha256(type:clipId:platform), check before enqueue
5. **Temp file cleanup** — always `rm -rf /tmp/clipflow-{jobId}` in finally block
6. **YouTube ≤ 60s** — enforce before upload, not after
7. **Facebook ≤ 90s** — enforce before upload, not after
8. **AI output validation** — always Zod.safeParse before use

## File Path Reference

| What | Where |
|---|---|
| BullMQ workers | `apps/api/src/jobs/*.worker.ts` |
| Social adapters | `apps/api/src/social/*.adapter.ts` |
| AI prompts/schemas | `apps/api/src/ai/` + `packages/shared/schemas/` |
| FFmpeg utils | `apps/api/src/ffmpeg/` |
| Prisma schema | `packages/db/schema.prisma` |
| Prisma config | `packages/db/prisma.config.ts` |
| Generated client | `packages/db/generated/` (never edit manually) |

## Subagents Available (Claude Code)

- `@pipeline-builder` — BullMQ workers + FFmpeg pipeline
- `@social-connector` — OAuth + publisher adapters
- `@ai-content-engineer` — segment picker + caption gen
- `@schema-guardian` — Prisma 7 schema review
- `@security-auditor` — security review
- `@test-runner` — run + create tests
- `@db-migrator` — Prisma migrations
