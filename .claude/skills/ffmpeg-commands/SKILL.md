---
name: ffmpeg-commands
description: |
  Referensi cepat FFmpeg commands untuk ClipFlow: trim, reframe, subtitle burn-in,
  thumbnail extraction, brand overlay, dan audio extraction.
  Termasuk sanitizeFfmpegPath() dan pola aman menggunakan execa().
  Trigger keywords: ffmpeg, trim, crop, reframe, subtitle, thumbnail, overlay, aspect ratio,
  9:16, 1:1, 16:9, burn-in, watermark, audio, extract
---

# FFmpeg Commands — ClipFlow Reference

## WAJIB: sanitizeFfmpegPath

```typescript
// apps/api/src/ffmpeg/sanitize.ts
export function sanitizeFfmpegPath(rawPath: string): string {
  if (!/^[a-zA-Z0-9_\-./]+$/.test(rawPath)) {
    throw new Error(`Unsafe FFmpeg path: ${rawPath}`);
  }
  return rawPath.replace(/:/g, '\\:'); // escape colon untuk subtitle filter
}
```

## Semua Command Wajib Pakai execa (bukan exec/spawn/shell)

```typescript
import { execa } from 'execa'; // npm install execa

// BENAR
await execa('ffmpeg', ['-i', safePath, ...args]);

// SALAH — injection risk!
// exec(`ffmpeg -i ${userInput} ...`)
// spawn('ffmpeg', { shell: true })
```

## Pipeline Lengkap Per Klip

### Step 1: Extract Audio
```typescript
await execa('ffmpeg', [
  '-y', '-i', inputVideoPath,
  '-vn', '-ar', '16000', '-ac', '1', '-f', 'wav',
  audioWavPath,
]);
```

### Step 2: Trim Klip
```typescript
// -ss sebelum -i = input seeking (cepat, frame-accurate)
// -t = durasi output (bukan end timestamp) — JANGAN pakai -to setelah -i
// karena -to setelah -i mengacu ke output timeline, bukan input
await execa('ffmpeg', [
  '-y',
  '-ss', String(startSec),              // seek SEBELUM -i untuk kecepatan
  '-i', inputVideoPath,                  // input SETELAH -ss
  '-t', String(endSec - startSec),      // durasi (= endSec - startSec), BUKAN end timestamp
  '-c:v', 'libx264', '-c:a', 'aac',
  '-movflags', '+faststart',            // untuk streaming web
  trimmedPath,
]);
```

### Step 3: Enforce Duration (YouTube ≤60s, Facebook ≤90s)
```typescript
import { ffprobe } from 'fluent-ffmpeg';

async function getDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffprobe(videoPath, (err, data) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      // streams[0].duration bisa undefined jika video corrupt — cari dengan aman
      const videoStream = data.streams?.find(s => s.codec_type === 'video');
      const rawDuration = videoStream?.duration ?? data.format?.duration;
      if (!rawDuration) return reject(new Error(`Cannot determine duration for: ${videoPath}`));
      resolve(parseFloat(String(rawDuration)));
    });
  });
}

// Trim ke max duration jika melebihi
async function enforceMaxDuration(inputPath: string, maxSec: number, outputPath: string) {
  const duration = await getDuration(inputPath);
  if (duration <= maxSec) {
    await fs.copyFile(inputPath, outputPath);
    return;
  }
  await execa('ffmpeg', [
    '-y', '-t', String(maxSec), '-i', inputPath,
    '-c', 'copy', outputPath,
  ]);
}
```

### Step 4: Reframe

```typescript
// 9:16 vertikal (TikTok, Instagram Reels, YouTube Shorts)
const FILTERS = {
  '9:16': 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920,setsar=1',
  '1:1':  'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=1080:1080,setsar=1',
  '16:9': 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
};

await execa('ffmpeg', [
  '-y', '-i', trimmedPath,
  '-vf', FILTERS[aspectRatio],
  '-c:v', 'libx264', '-c:a', 'aac',
  reframedPath,
]);
```

### Step 5: Burn Subtitle
```typescript
const safeSrt = sanitizeFfmpegPath(srtLocalPath);
await execa('ffmpeg', [
  '-y', '-i', reframedPath,
  '-vf', `subtitles=${safeSrt}:force_style='FontSize=22,Bold=1,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3'`,
  '-c:v', 'libx264', '-c:a', 'copy',
  subtitledPath,
]);
```

### Step 6: Brand Overlay (Logo)
```typescript
await execa('ffmpeg', [
  '-y', '-i', subtitledPath, '-i', logoPath,
  '-filter_complex', '[0:v][1:v]overlay=W-w-20:20[out]',
  '-map', '[out]', '-map', '0:a',
  '-c:v', 'libx264', '-c:a', 'copy',
  finalPath,
]);
```

### Step 7: Extract Thumbnail (Best Frame)
```typescript
// Ambil 10 frame kandidat, pilih yang paling tajam
async function extractBestThumbnail(videoPath: string, outputPath: string) {
  const duration = await getDuration(videoPath);
  const candidates: string[] = [];
  
  // Ambil frame di 10%, 20%, ..., 100% durasi
  for (let i = 1; i <= 10; i++) {
    const ts = (duration * i / 10).toFixed(2);
    const candidatePath = outputPath.replace('.jpg', `_${i}.jpg`);
    await execa('ffmpeg', [
      '-y', '-ss', ts, '-i', videoPath,
      '-frames:v', '1', '-q:v', '2', candidatePath,
    ]);
    candidates.push(candidatePath);
  }
  
  // Pilih frame dengan sharpness tertinggi (variance of Laplacian)
  // Implementasi di Python atau pakai ffmpeg blurdetect filter
  const best = await scoreAndSelectBestFrame(candidates);
  await fs.copyFile(best, outputPath);
  
  // Hapus kandidat lainnya
  await Promise.all(candidates.filter(c => c !== best).map(c => fs.unlink(c).catch(() => {})));
}
```

## Troubleshooting Umum

| Error | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `No such file or directory` | Path tidak valid atau file belum ada | Pastikan file MinIO sudah di-download ke temp |
| `Invalid data found when processing input` | Video corrupt atau format tidak didukung | Validasi magic bytes saat upload |
| `Output file #0 does not contain any stream` | Filter salah atau video 0 detik | Cek start/end timestamp valid |
| `Subtitle file not found` | Path SRT bermasalah | Gunakan sanitizeFfmpegPath() |
| `Unable to find a suitable output format for` | Extension file salah | Pastikan output path berakhir .mp4 |
