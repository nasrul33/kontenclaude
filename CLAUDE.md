# ClipFlow — CLAUDE.md (Project Constitution)

## Stack (v3 · Juni 2026)

Monorepo: pnpm workspaces
- `apps/api/` — Fastify 5.8.x, Node.js 24 LTS, TypeScript 5.8
- `apps/web/` — Next.js 16.3.x, React 19.2, Turbopack default
- `packages/db/` — Prisma 7.8.x (Rust-free, WebAssembly engine)
- `packages/shared/` — Zod schemas, types, utils
- `infra/` — Docker Compose 3.9, Nginx 1.27, env templates

Queue: BullMQ 5.x + Redis 7.4.x (pin minor — AGPLv3 concern pada v8+)
Database: PostgreSQL 18.4 (postgres:18-alpine)
Storage: MinIO (S3-compatible) — key convention: {userId}/{projectId}/{type}/{filename}
Auth: Better Auth (Lucia v3 deprecated)
Transcription: faster-whisper + model large-v3-turbo (4x faster dari openai-whisper)
Video: FFmpeg 7.x (system binary), PySceneDetect 0.6.x
AI: claude-sonnet-4-6 (segment picker + caption gen)
Testing: Vitest 3.x + Playwright 1.x
Python venv: `.venv/` di `apps/api/` untuk faster-whisper — JANGAN install ke system Python

## Non-Negotiable Invariants — JANGAN PERNAH DILANGGAR

1. **Video/klip HANYA di MinIO** — jangan tulis ke disk lokal permanen; temp files di `/tmp/clipflow-{jobId}/`
2. **OAuth token WAJIB AES-256-GCM** sebelum masuk DB — kolom `encryptedToken (Bytes)` + `tokenIv` + `tokenTag`
3. **BullMQ job WAJIB idempoten** — `jobId = sha256(type:clipId:platform)`, cek duplikat sebelum enqueue
4. **Schema via `pnpm db:migrate`** — jangan direct SQL, jangan edit migration yang sudah di-commit
5. **FFmpeg WAJIB `execa()`** tanpa `shell:true` + `sanitizeFfmpegPath()` sebelum argumen user masuk
6. **API key TIDAK boleh di-log** — Pino redact: `["req.headers.authorization","*.token","*.secret","*.password"]`
7. **TikTok token expiry 24 jam** — WAJIB `ensureFreshToken()` sebelum setiap publish
8. **YouTube Shorts WAJIB ≤ 60 detik** — enforce ffprobe + trim sebelum upload
9. **Facebook Reels WAJIB ≤ 90 detik** — enforce di `facebook.adapter.ts`
10. **AI output WAJIB Zod-validated** sebelum digunakan — jangan asumsi JSON Claude selalu valid
11. **File upload WAJIB magic bytes check** via `file-type` library, bukan hanya Content-Type header
12. **Prisma config** via `prisma.config.ts` — `provider = "prisma-client"` (bukan "prisma-client-js")
13. **Temp files WAJIB dibersihkan** setelah job selesai/gagal — hapus `/tmp/clipflow-{jobId}/` di `finally` block
14. **Prisma import** selalu dari generated path: `from '../../../packages/db/generated'` (bukan `@prisma/client`)

## Platform Constraints (Enforced di Pipeline — Tidak Boleh Dilanggar)

| Platform | Max Durasi | Max File | Catatan |
|---|---|---|---|
| TikTok | 10 menit | 287.6 MB | Token expiry 24 jam — auto-refresh wajib |
| Instagram Reels | 15 menit | 1 GB | Min 3 detik; butuh Creator/Business account |
| YouTube Shorts | **60 DETIK** | 256 GB | Harus 9:16 DAN ≤60s untuk jadi Shorts |
| X/Twitter | 2 menit 20 detik | 512 MB | OAuth 2.0 PKCE; scope: `tweet.write users.read media.write offline.access` |
| Facebook Reels | **90 DETIK** | 4 GB | Reels (bukan Feed video); butuh Pages access |

## Dev Commands

```bash
pnpm dev              # Docker Compose up + watch semua services
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # prisma studio (GUI)
pnpm db:seed          # seed data development
pnpm test             # vitest run + playwright test
pnpm test:unit        # vitest run --reporter=verbose
pnpm test:e2e         # playwright test
pnpm lint             # eslint + tsc --noEmit
pnpm build            # production build semua apps
pnpm worker:dev       # jalankan BullMQ workers saja (tanpa web)
pnpm worker:inspect   # inspeksi BullMQ queues (require bull-board atau similar)

# Python (faster-whisper) — jalankan dari apps/api/
python -m venv .venv && source .venv/bin/activate
pip install faster-whisper          # BUKAN pip install openai-whisper
```

## Cara Memanggil Subagent

```
# Eksplisit dari chat Claude Code
@pipeline-builder buat render.worker.ts
@social-connector debug TikTok 401 error
@ai-content-engineer optimasi caption Instagram
@schema-guardian review migration terbaru
@security-auditor review crypto/token.ts
@test-runner jalankan test untuk render worker
@db-migrator buat migration tambah kolom scheduledAt di captions

# Atau lewat /agents untuk melihat semua subagent
```

## File Conventions

```
apps/api/src/jobs/
  *.worker.ts         — BullMQ Worker class (1 file per job type)
  *.queue.ts          — Queue definition + job type (1 file per queue)

apps/api/src/social/
  *.adapter.ts        — Publisher per platform (1 file per platform)
  base.adapter.ts     — Abstract base dengan ensureFreshToken()

apps/api/src/ai/
  segment-picker.ts   — Claude segment picker + Zod validation
  caption-gen.ts      — Caption per platform + Zod validation
  call-ai.ts          — Generic AI caller dengan retry + validation

apps/api/src/ffmpeg/
  trim.ts             — Trim dengan timestamp validation
  reframe.ts          — Reframe ke 9:16/1:1/16:9
  subtitle.ts         — Burn-in SRT dengan sanitizeFfmpegPath()
  thumbnail.ts        — Extract best frame dengan scoring
  sanitize.ts         — sanitizeFfmpegPath() function
  index.ts            — Re-export semua

apps/api/src/crypto/
  token.ts            — AES-256-GCM encrypt/decrypt untuk OAuth token

apps/api/src/storage/
  minio.ts            — MinIO client wrapper + key convention helper

packages/db/
  prisma.config.ts    — Prisma 7 config (WAJIB ada)
  schema.prisma       — Single source of truth schema
  generated/          — Prisma generated client (jangan edit manual)
```

## Prisma Import Path (Prisma 7)

```typescript
// BENAR — pakai generated path
import { PrismaClient } from '../../../packages/db/generated';
// atau
import { prisma } from '../lib/prisma'; // singleton instance

// SALAH — jangan pakai ini (Prisma 7 tidak lagi export dari @prisma/client)
import { PrismaClient } from '@prisma/client'; // ← JANGAN
```

## MinIO Key Convention

```
{userId}/{projectId}/source/{originalFilename}     — video asli
{userId}/{projectId}/clips/{clipId}/final.mp4      — klip final
{userId}/{projectId}/clips/{clipId}/subtitled.mp4  — dengan subtitle
{userId}/{projectId}/clips/{clipId}/thumb.jpg      — thumbnail
{userId}/{projectId}/srt/{clipId}.srt              — file subtitle
```

## Temp File Policy

Setiap job WAJIB menggunakan temp dir yang dibersihkan:
```typescript
const tmpDir = `/tmp/clipflow-${job.id}`;
await fs.mkdir(tmpDir, { recursive: true });
try {
  // ... kerja di sini
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true }); // SELALU bersihkan
}
```

## AI Usage

- Provider via `AI_PROVIDER` env: `anthropic` (default) atau `openai`. Satu titik di `src/ai/call-ai.ts` (provider impl di `src/ai/providers/`). Model via `ANTHROPIC_MODEL` / `OPENAI_MODEL`.
- Model default: `claude-sonnet-4-6` (Anthropic) / `gpt-4o-mini` (OpenAI) untuk segment picker dan caption gen
- SELALU validasi output AI dengan Zod sebelum digunakan
- JANGAN log full prompt — bisa mengandung transcript sensitif
- Gunakan `callAI<T>(prompt, schema)` helper di `src/ai/call-ai.ts`
- Strip markdown code fences sebelum JSON.parse

## Known Platform Limitations

- TikTok: token valid 24 jam, max video 10 menit, max file 287.6MB
- Instagram: butuh Creator/Business account (Personal account tidak bisa Reels API)
- Instagram: schedule Reels via API butuh `publish_scheduled` permission tambahan
- YouTube Shorts: video HARUS ≤ 60 detik DAN aspect ratio 9:16
- X/Twitter: video max 512MB, max 140 detik; scope wajib: `tweet.write users.read media.write offline.access`
- Facebook: Reels (bukan Feed) max 90 detik; butuh Pages access (bukan Personal)

## Architecture Decisions

- Redis 7.4.x dipilih (bukan 8.x) — AGPLv3 concern pada Redis 8.x untuk self-hosted commercial
- faster-whisper dipilih (bukan openai-whisper) — 4x lebih cepat, akurasi sama
- Better Auth dipilih (bukan Lucia) — Lucia v3 deprecated oleh pembuat
- Prisma 7.x dipilih (bukan Drizzle) — type-safety lebih kuat, 70% faster TS check
- execa() dipilih (bukan child_process.exec) — no shell injection risk

## .gitignore Notes

File yang TIDAK boleh di-commit:
- `.env`, `.env.*` (kecuali `.env.example`)
- `packages/db/generated/` (Prisma generated client)
- `apps/api/.venv/` (Python virtual env)
- `.claude/ai-edit-audit.log` (audit log lokal)
- `/tmp/` dan `uploads/` (temp files)
- `*.key`, `*.pem`, `*.p12` (certificate files)
