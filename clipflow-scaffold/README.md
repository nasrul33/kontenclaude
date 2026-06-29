# ClipFlow — Video-to-Social Clip Automation

Upload satu video → AI memilih klip terbaik → auto-publish ke TikTok, Instagram, YouTube Shorts, X, Facebook.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript 5.8 |
| API | Fastify 5.8.x |
| Queue | BullMQ 5.x + Redis 7.4.x |
| Database | PostgreSQL 18 + Prisma 7.8.x |
| Storage | MinIO (S3-compatible) |
| AI | Claude Sonnet 4 (segment picker + caption gen) |
| Transcription | faster-whisper + large-v3-turbo |
| Video | FFmpeg 7.x, PySceneDetect 0.6.x |
| Frontend | Next.js 16.3.x, React 19.2 |
| Auth | Better Auth |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 24+ & pnpm 10+
- Python 3.11+

### 1. Clone & Install

```bash
git clone https://github.com/your-org/clipflow
cd clipflow
cp .env.example .env
# Edit .env — isi semua CHANGE_ME dengan nilai nyata
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm infra:up        # Start postgres, redis, minio, nginx
pnpm infra:init      # Create MinIO buckets (run once)
```

### 3. Setup Database

```bash
pnpm db:migrate      # Run migrations
pnpm db:seed         # Seed dev user
pnpm db:studio       # Open Prisma Studio (optional)
```

### 4. Start Development

```bash
pnpm dev             # Start API + Web concurrently
pnpm worker:dev      # Start BullMQ workers (separate terminal)
```

App berjalan di:
- **Web Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **MinIO Console**: http://localhost:9001

## Claude Code

Project ini dilengkapi dengan primitif Claude Code lengkap di `.claude/`:

```bash
# Subagents tersedia
@pipeline-builder   — BullMQ workers + FFmpeg
@social-connector   — OAuth + publisher adapters
@ai-content-engineer— segment picker + caption gen
@schema-guardian    — Prisma 7 schema review
@security-auditor   — security review
@test-runner        — run + create tests
@db-migrator        — Prisma migrations
```

## Key Constraints

- **YouTube Shorts**: video WAJIB ≤ 60 detik + aspect ratio 9:16
- **Facebook Reels**: video WAJIB ≤ 90 detik
- **TikTok**: token expire setiap 24 jam — auto-refresh active
- **Redis**: pin 7.4.x (AGPLv3 concern pada v8+)
- **OAuth token**: AES-256-GCM encrypted, NEVER plaintext in DB

## Testing

```bash
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright)
```

## Deployment

```bash
# Production
docker compose -f infra/docker-compose.yml up -d --build
```

Lihat [CLAUDE.md](./CLAUDE.md) untuk konvensi lengkap.
