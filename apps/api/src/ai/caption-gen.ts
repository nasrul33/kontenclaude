import { CaptionSchema, type Caption, type Platform } from '@clipflow/shared';
import { callAI } from './call-ai.js';

const CAPTION_PROMPTS: Record<Platform, string> = {
  TIKTOK: `Buat caption TikTok. body = hook 1 kalimat + 2-3 kalimat CASUAL/GAUL + CTA. hashtags = 5-10 (campur ID + EN).`,
  INSTAGRAM: `Buat caption Instagram Reels. body = 150-220 karakter, tone LIFESTYLE/ASPIRATIONAL, tanpa hashtag di body. hashtags = 8-15.`,
  YOUTUBE: `Buat YouTube Shorts. title = SEO <=60 karakter. body = deskripsi 3 kalimat. tags = 5-10 kata/frasa pendek.`,
  TWITTER: `Buat tweet <=240 karakter, CONCISE & PROVOCATIVE. hashtags = 2-3 saja.`,
  FACEBOOK: `Buat caption Facebook Reels. body = 300-500 karakter, tone KOMUNITAS, akhiri ajakan komentar. hashtags = 3-5.`,
};

export function buildCaptionPrompt(
  platform: Platform,
  transcript: string,
  langCode: string,
): string {
  const spec = CAPTION_PROMPTS[platform];
  const lang = langCode === 'id' ? 'Bahasa Indonesia' : 'English';
  const truncated = transcript.slice(0, 3000);
  return `
${spec}

TRANSCRIPT: ${truncated}
BAHASA: ${lang}

Output HANYA JSON valid sesuai schema:
{"body":"...","hashtags":["..."],"title":"(opsional)","tags":["(opsional)"]}
`.trim();
}

export async function generateCaption(
  platform: Platform,
  transcript: string,
  langCode: string,
): Promise<Caption> {
  return callAI({
    prompt: buildCaptionPrompt(platform, transcript, langCode),
    schema: CaptionSchema,
    maxTokens: 1024,
  });
}
