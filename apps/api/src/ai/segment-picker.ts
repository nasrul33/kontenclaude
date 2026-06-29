import { SegmentResultSchema, type SegmentResult } from '@clipflow/shared';
import { callAI } from './call-ai.js';

export function buildSegmentPickerPrompt(srtContent: string, langCode: string): string {
  const lang = langCode === 'id' ? 'Bahasa Indonesia' : 'English';
  // Truncate to keep token budget bounded; long transcripts still give enough signal.
  const srt = srtContent.slice(0, 12000);
  return `
Kamu adalah AI editor video profesional. Analisis transcript SRT berikut dan pilih
segmen terbaik untuk short-form video (30-90 detik).

TRANSCRIPT (SRT):
${srt}

BAHASA: ${lang}

KRITERIA WAJIB:
- Hook kuat di 3 detik pertama (pertanyaan / fakta mengejutkan / narasi emosional)
- Information density tinggi (>=3 kata/detik)
- Tidak ada silence > 2 detik
- Konten standalone (tidak butuh konteks sebelumnya)
- Hindari banyak filler ("eee", "umm", "jadi" berulang)

Pilih 3-5 segmen. Output HANYA JSON valid (tanpa teks lain), schema:
{"segments":[{"startSec":0,"endSec":45,"score":8.5,"reason":"...","hookPreview":"..."}],"langDetected":"id"}
`.trim();
}

export async function pickSegments(srtContent: string, langCode: string): Promise<SegmentResult> {
  return callAI({
    prompt: buildSegmentPickerPrompt(srtContent, langCode),
    schema: SegmentResultSchema,
    maxTokens: 1536,
  });
}
