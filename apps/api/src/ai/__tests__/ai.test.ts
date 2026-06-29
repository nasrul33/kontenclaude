import { vi, describe, it, expect, beforeEach } from 'vitest';

// Full env required by loadEnv() before any AI module import.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MINIO_ACCESS_KEY = 'x';
process.env.MINIO_SECRET_KEY = 'x';
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_COOKIE_SECRET = '0123456789abcdef0123';
process.env.ANTHROPIC_API_KEY = 'test-key';

const createMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}));

const textReply = (text: string) => ({ content: [{ type: 'text', text }] });

import { callAI } from '../call-ai.js';
import { buildSegmentPickerPrompt, pickSegments } from '../segment-picker.js';
import { buildCaptionPrompt } from '../caption-gen.js';
import { z } from 'zod';

beforeEach(() => createMock.mockReset());

describe('prompt builders', () => {
  it('segment picker prompt carries SRT + language', () => {
    const p = buildSegmentPickerPrompt('1\n00:00:01,000 --> 00:00:03,000\nHalo', 'id');
    expect(p).toContain('Bahasa Indonesia');
    expect(p).toContain('Halo');
    expect(p).toContain('segments');
  });

  it('caption prompt differs per platform', () => {
    const tt = buildCaptionPrompt('TIKTOK', 'transcript', 'id');
    const yt = buildCaptionPrompt('YOUTUBE', 'transcript', 'en');
    expect(tt).toContain('TikTok');
    expect(yt).toContain('YouTube');
    expect(yt).toContain('English');
  });
});

describe('callAI', () => {
  const schema = z.object({ ok: z.boolean() });

  it('parses a valid JSON text reply', async () => {
    createMock.mockResolvedValueOnce(textReply('{"ok":true}'));
    await expect(callAI({ prompt: 'x', schema })).resolves.toEqual({ ok: true });
  });

  it('strips ```json fences', async () => {
    createMock.mockResolvedValueOnce(textReply('```json\n{"ok":false}\n```'));
    await expect(callAI({ prompt: 'x', schema })).resolves.toEqual({ ok: false });
  });

  it('retries once then throws on persistently invalid output', async () => {
    createMock.mockResolvedValue(textReply('not json at all'));
    await expect(callAI({ prompt: 'x', schema })).rejects.toThrow(/validation/i);
    expect(createMock).toHaveBeenCalledTimes(2); // initial + one repair retry
  });
});

describe('pickSegments', () => {
  it('returns a validated SegmentResult', async () => {
    createMock.mockResolvedValueOnce(
      textReply(
        JSON.stringify({
          segments: [
            { startSec: 10, endSec: 40, score: 8.2, reason: 'kuat', hookPreview: 'Tahukah kamu' },
          ],
          langDetected: 'id',
        }),
      ),
    );
    const res = await pickSegments('srt', 'id');
    expect(res.segments).toHaveLength(1);
    expect(res.langDetected).toBe('id');
  });
});
