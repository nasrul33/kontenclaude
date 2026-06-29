---
name: ai-content-engine
description: |
  Pola prompt engineering dan Zod schema untuk AI Content Engine ClipFlow.
  Segment picker (memilih klip terbaik dari transcript) dan caption generator (per platform).
  Trigger keywords: segment picker, caption, AI, Claude API, prompt, Zod, schema,
  transcript, hashtag, tone, Bahasa Indonesia, hook, CTA
---

# AI Content Engine — ClipFlow Reference

## callAI Helper (Wajib Digunakan)

```typescript
// apps/api/src/ai/call-ai.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callAI<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  maxTokens = 1024,
): Promise<T> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip markdown code fences jika ada
  const cleaned = raw
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned non-JSON output: ${cleaned.substring(0, 150)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `AI output tidak sesuai schema: ${result.error.message}\nOutput: ${cleaned.substring(0, 200)}`
    );
  }
  return result.data;
}
```

## Segment Picker

### Zod Schema
```typescript
// packages/shared/schemas/segment-picker.schema.ts
export const SegmentSchema = z.object({
  startSec:    z.number().min(0),
  endSec:      z.number().min(0),
  score:       z.number().min(0).max(10),
  reason:      z.string().max(200),
  hookPreview: z.string().max(100), // 3-5 kata pertama untuk preview UI
});

export const SegmentResultSchema = z.object({
  segments:     z.array(SegmentSchema).min(1).max(10),
  langDetected: z.string().length(2), // "id" atau "en"
});
```

### Prompt Template
```typescript
export function buildSegmentPickerPrompt(
  srtContent: string,
  keyframes: Array<{ ts: number; motionScore: number }>,
  langCode: string,
): string {
  return `
Kamu adalah AI editor video profesional. Analisis transcript SRT dan keyframe berikut.

TRANSCRIPT (SRT format):
${srtContent}

KEYFRAMES (timestamp + motion score):
${JSON.stringify(keyframes.slice(0, 50))}

BAHASA: ${langCode === 'id' ? 'Bahasa Indonesia' : 'English'}

Pilih 3-5 segmen terbaik untuk short-form video (30-90 detik).

KRITERIA WAJIB:
- Hook kuat di 3 detik pertama (pertanyaan / fakta mengejutkan / narasi emosional)
- Information density tinggi (≥3 kata/detik rata-rata)
- Tidak ada silence > 2 detik
- Konten standalone (tidak butuh konteks dari sebelumnya)
- Hindari segmen dengan banyak kata filler ("eeee", "umm", "jadi", berulang)

KRITERIA POSITIF (bonus score):
- Segmen yang mengandung tips praktis, fakta menarik, atau momen emosional
- Awal dengan kata tanya atau kalimat provokatif

Output HANYA JSON valid, tidak ada teks lain:
{"segments":[{"startSec":0,"endSec":45,"score":8.5,"reason":"Hook kuat...","hookPreview":"Tahukah kamu..."}],"langDetected":"id"}
`.trim();
}
```

## Caption Generator

### Zod Schema
```typescript
// packages/shared/schemas/caption.schema.ts
export const CaptionSchema = z.object({
  body:     z.string().min(10).max(2200),
  hashtags: z.array(z.string().min(1)).min(1).max(30),
  title:    z.string().max(100).optional(), // untuk YouTube
  tags:     z.array(z.string()).max(500).optional(), // untuk YouTube
});
```

### Prompt per Platform
```typescript
export const CAPTION_PROMPTS: Record<string, string> = {
  TIKTOK: `
Buat caption TikTok untuk klip video ini.
TRANSCRIPT: {transcript}
BAHASA: {langCode}

Format OUTPUT (JSON):
- body: hook 1 kalimat pendek + body 2-3 kalimat CASUAL/GAUL + CTA ("Follow untuk tips lebih!")
- hashtags: 5-10 hashtag relevan, campurkan Indonesia dan English

Output HANYA JSON: {"body":"...","hashtags":["tips","tipssehat",...]}
`,
  INSTAGRAM: `
Buat caption Instagram Reels untuk klip video ini.
TRANSCRIPT: {transcript}
BAHASA: {langCode}

Format OUTPUT (JSON):
- body: 150-220 karakter, tone LIFESTYLE/ASPIRATIONAL, tanpa hashtag di dalam body
- hashtags: 8-15 hashtag yang relevan

Output HANYA JSON: {"body":"...","hashtags":[...]}
`,
  YOUTUBE: `
Buat judul dan deskripsi YouTube Shorts untuk klip video ini.
TRANSCRIPT: {transcript}
BAHASA: {langCode}

Format OUTPUT (JSON):
- title: judul SEO-friendly ≤60 karakter
- body: deskripsi 3 kalimat informatif
- tags: 5-10 tag YouTube (kata tunggal atau frasa pendek)

Output HANYA JSON: {"title":"...","body":"...","tags":["tag1","tag2"]}
`,
  TWITTER: `
Buat tweet untuk klip video ini (≤280 karakter termasuk hashtag).
TRANSCRIPT: {transcript}
BAHASA: {langCode}

Format OUTPUT (JSON):
- body: tweet ≤240 karakter, CONCISE dan PROVOCATIVE
- hashtags: 2-3 hashtag saja

Output HANYA JSON: {"body":"...","hashtags":[...]}
`,
  FACEBOOK: `
Buat caption Facebook Reels untuk klip video ini.
TRANSCRIPT: {transcript}
BAHASA: {langCode}

Format OUTPUT (JSON):
- body: 300-500 karakter, tone KOMUNITAS, akhiri dengan ajakan komentar/diskusi
- hashtags: 3-5 hashtag umum

Output HANYA JSON: {"body":"...","hashtags":[...]}
`,
};

// WAJIB: fungsi untuk mengisi template {transcript} dan {langCode}
export function buildCaptionPrompt(
  platform: string,
  transcript: string,
  langCode: string,
): string {
  const template = CAPTION_PROMPTS[platform];
  if (!template) throw new Error(`Unknown platform: ${platform}`);

  // Truncate transcript agar tidak melebihi token limit
  const truncated = transcript.substring(0, 3000);

  return template
    .replace('{transcript}', truncated)
    .replace('{langCode}', langCode);
}
```

## Retry Policy untuk AI Call

```typescript
// Jika AI mengembalikan output tidak valid, retry maksimal 2x
export async function callAIWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  maxRetries = 2,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(prompt, schema);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        // Tunggu sebentar sebelum retry
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}
```
