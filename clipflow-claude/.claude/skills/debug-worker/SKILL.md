---
name: debug-worker
description: |
  Panduan debug BullMQ worker ClipFlow yang gagal atau berperilaku tidak terduga.
  Langkah-langkah diagnosis untuk setiap tipe failure: ingest, transcribe, render, publish.
  Trigger keywords: debug, worker gagal, job failed, error, stuck, tidak jalan, queue kosong,
  token invalid, FFmpeg error, MinIO error, Prisma error, publish gagal
---

# Debug Worker — ClipFlow Reference

## Checklist Diagnosis Umum

Saat worker gagal, jalankan langkah ini berurutan:

### 1. Cek Job Status di DB
```sql
-- Lihat job terbaru yang gagal
SELECT id, type, status, error_msg, attempts, created_at, ran_at
FROM jobs
WHERE status IN ('FAILED', 'DEAD')
ORDER BY created_at DESC
LIMIT 20;

-- Lihat clip yang stuck
SELECT id, project_id, status, created_at
FROM clips
WHERE status = 'PROCESSING'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

### 2. Cek BullMQ Queue via CLI
```bash
# Lihat semua job di queue
pnpm worker:inspect

# Atau via Redis CLI
redis-cli -h localhost -p 6379 -a $REDIS_PASSWORD
> KEYS bull:render:*
> HGETALL bull:render:failed
```

### 3. Cek Docker Logs
```bash
docker compose logs worker --tail=100 --follow
docker compose logs api --tail=100
```

## Debug Per Worker Type

### ingest.worker — Download/Upload Gagal
```
Gejala: Project.status tetap PENDING atau jadi FAILED
Cek:
  1. Apakah URL video valid? (yt-dlp bisa download?)
  2. Apakah MinIO bisa diakses? (docker compose ps minio)
  3. Apakah magic bytes check melempar error?
  4. Apakah file > batas ukuran platform?

Debug command:
  docker compose exec api node -e "
    const { minioClient } = require('./dist/storage/minio');
    minioClient.listBuckets().then(console.log).catch(console.error);
  "
```

### transcribe.worker — Whisper Gagal
```
Gejala: Clip tidak punya SRT, status tetap PROCESSING
Cek:
  1. Apakah faster-whisper ter-install? (pip show faster-whisper)
  2. Apakah audio WAV berhasil di-extract?
  3. Apakah langCode valid? ("id" atau "en")
  4. Apakah GPU memory cukup? (nvidia-smi)

Debug command:
  # Test whisper manual
  python3 -c "
  from faster_whisper import WhisperModel
  model = WhisperModel('large-v3-turbo', device='auto', compute_type='int8')
  segs, info = model.transcribe('/path/to/audio.wav', language='id')
  for s in segs: print(s.start, s.end, s.text)
  "
```

### render.worker — FFmpeg Gagal
```
Gejala: Clip.status = FAILED, Job.errorMsg mengandung FFmpeg error
Cek:
  1. Apakah input file ada di MinIO?
  2. Apakah path aman (sanitizeFfmpegPath tidak throw)?
  3. Apakah SRT file valid?
  4. Apakah disk temp cukup?

Debug command:
  # Test FFmpeg manual dengan command yang sama
  ffmpeg -y -i /tmp/input.mp4 \
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
    /tmp/output.mp4
```

### publish.worker — Platform API Error
```
Gejala: Publication.status = FAILED, errorMsg berisi HTTP 4xx/5xx
Cek:
  1. HTTP status code berapa?
     - 401 → token expired (ensureFreshToken gagal?)
     - 403 → scope OAuth kurang
     - 400 → format video atau parameter salah
     - 422 → constraint platform dilanggar (durasi, ukuran)
  2. Apakah video sesuai constraint platform?
     - YouTube: ≤60 detik + 9:16
     - Facebook: ≤90 detik
     - TikTok: ≤10 menit + ≤287.6MB
  3. Apakah token masih valid? (SocialAccount.expiresAt)

Debug command:
  # Cek token di DB (HANYA ID, bukan token asli!)
  SELECT id, platform, expires_at, 
         (expires_at - NOW()) as time_until_expiry
  FROM social_accounts
  WHERE user_id = 'USER_ID';
```

## Pattern: Force Retry Job

```typescript
// Untuk re-queue job yang stuck atau perlu di-retry manual
import { Queue } from 'bullmq';
import { redis } from './lib/redis';

async function retryJob(queueName: string, jobId: string) {
  const queue = new Queue(queueName, { connection: redis });
  const job = await queue.getJob(jobId);
  
  if (!job) throw new Error(`Job ${jobId} tidak ditemukan`);
  
  await job.retry();
  console.log(`Job ${jobId} di-retry`);
}
```

## Pattern: Dead-Letter Handler

```typescript
// Pastikan ini ada di setiap worker
worker.on('failed', async (job, err) => {
  if (!job) return;
  
  // Update status di DB
  await prisma.job.update({
    where: { bullId: job.id },
    data: { 
      status: job.attemptsMade >= job.opts.attempts! ? 'DEAD' : 'FAILED',
      errorMsg: err.message.substring(0, 500),
    },
  });
  
  // Alert via Sentry
  Sentry.captureException(err, {
    extra: { jobId: job.id, type: job.name, attemptsMade: job.attemptsMade },
  });
  
  // Update entity status juga
  if (job.data.clipId) {
    await prisma.clip.update({
      where: { id: job.data.clipId },
      data: { status: 'FAILED' },
    }).catch(() => {}); // jangan crash jika clip tidak ada
  }
});
```
