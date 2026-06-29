---
name: clipflow-pipeline
description: |
  Pengetahuan lengkap pipeline video processing ClipFlow: BullMQ workers, FFmpeg commands,
  faster-whisper transcription, PySceneDetect, MinIO storage, dan error handling patterns.
  Gunakan skill ini saat membangun atau memodifikasi bagian apapun dari pipeline processing.
  Trigger keywords: pipeline, worker, BullMQ, queue, transcribe, segment, render, publish,
  ffmpeg, whisper, MinIO, storage, job
---

# ClipFlow Pipeline — Reference Skill

## Job Type & Queue Mapping

```
ingest       → ingestQueue      — Download/validasi video → MinIO
transcribe   → transcribeQueue  — Audio WAV → faster-whisper → SRT
segment      → segmentQueue     — PySceneDetect + Claude → Clip records
render       → renderQueue      — FFmpeg pipeline per klip
publish      → publishQueue     — Upload + post ke platform sosial
analytics    → analyticsQueue   — Pull analytics API (cron 6 jam)
```

## BullMQ Worker Template

```typescript
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../../../packages/db/generated'; // 3 level up dari src/jobs/
import { logger } from '../lib/logger';

export const renderWorker = new Worker(
  'render',
  async (job: Job<RenderJobData>) => {
    const { clipId, aspectRatio } = job.data;
    
    // 1. Update status di DB
    await prisma.clip.update({
      where: { id: clipId },
      data: { status: 'PROCESSING' },
    });
    
    try {
      // 2. Lakukan kerja
      const outputPath = await runRenderPipeline(clipId, aspectRatio);
      
      // 3. Update status sukses
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'READY', storagePath: outputPath },
      });
    } catch (error) {
      // 4. Update status gagal
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'FAILED' },
      });
      await prisma.job.update({
        where: { bullId: job.id },
        data: { status: 'FAILED', errorMsg: String(error) },
      });
      throw error; // re-throw agar BullMQ retry
    }
  },
  {
    connection: redis,
    concurrency: 4,
  }
);

renderWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'render job failed');
  // Kirim ke Sentry
  Sentry.captureException(err, { extra: { jobId: job?.id } });
});
```

## faster-whisper Command Pattern

```python
# Di Python transcription script (dipanggil via execa dari Node)
from faster_whisper import WhisperModel

model = WhisperModel("large-v3-turbo", device="auto", compute_type="int8")

def transcribe(audio_path: str, lang_code: str) -> list[dict]:
    segments, info = model.transcribe(
        audio_path,
        language=lang_code,  # "id" untuk Indonesia, "en" untuk English
        beam_size=5,
        vad_filter=True,     # skip silence otomatis
    )
    
    result = []
    for seg in segments:
        result.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        })
    return result
```

## FFmpeg Command Patterns

### Trim klip
```typescript
await execa('ffmpeg', [
  '-y', '-ss', String(startSec), '-to', String(endSec),
  '-i', inputPath,
  '-c:v', 'libx264', '-c:a', 'aac',
  outputPath,
]);
```

### Reframe ke 9:16 (vertikal)
```typescript
await execa('ffmpeg', [
  '-y', '-i', inputPath,
  '-vf', 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920,setsar=1',
  '-c:v', 'libx264', '-c:a', 'aac',
  outputPath,
]);
```

### Burn subtitle
```typescript
const safeSrt = sanitizeFfmpegPath(srtPath);
await execa('ffmpeg', [
  '-y', '-i', inputPath,
  '-vf', `subtitles=${safeSrt}:force_style='FontSize=22,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&'`,
  outputPath,
]);
```

### Extract thumbnail
```typescript
await execa('ffmpeg', [
  '-y', '-ss', String(bestFrameSec),
  '-i', inputPath,
  '-frames:v', '1', '-q:v', '2',
  thumbPath,
]);
```

## MinIO Operations

```typescript
import { minioClient } from '../storage/minio';

// Upload ke MinIO
async function uploadToMinio(
  localPath: string,
  userId: string,
  projectId: string,
  type: 'clips' | 'srt' | 'thumbnails',
  filename: string,
): Promise<string> {
  const key = `${userId}/${projectId}/${type}/${filename}`;
  await minioClient.fPutObject(
    process.env.MINIO_BUCKET_CLIPS!,
    key,
    localPath,
  );
  return key;
}

// Buat presigned URL untuk preview
async function getPresignedUrl(key: string): Promise<string> {
  return minioClient.presignedGetObject(
    process.env.MINIO_BUCKET_CLIPS!,
    key,
    60 * 60, // 1 jam expiry
  );
}
```

## Error Handling Pattern

Setiap error di worker HARUS:
1. Update `Clip.status` atau `Publication.status` ke 'FAILED'
2. Simpan pesan error di `Job.errorMsg`
3. Re-throw error agar BullMQ bisa retry
4. Kirim ke Sentry dengan context (jobId, clipId, userId)
