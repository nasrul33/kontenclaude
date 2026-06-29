import { vi, describe, it, expect, beforeEach } from 'vitest';

// Select the OpenAI provider BEFORE imports run (vitest hoists vi.hoisted).
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.MINIO_ACCESS_KEY = 'x';
  process.env.MINIO_SECRET_KEY = 'x';
  process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.SESSION_COOKIE_SECRET = '0123456789abcdef0123';
  process.env.ANTHROPIC_API_KEY = 'x';
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-openai-key';
});

const createMock = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createMock } },
  })),
}));

const reply = (content: string) => ({ choices: [{ message: { content } }] });

import { callAI } from '../call-ai.js';
import { z } from 'zod';

beforeEach(() => createMock.mockReset());

describe('callAI with AI_PROVIDER=openai', () => {
  const schema = z.object({ ok: z.boolean() });

  it('parses a valid JSON reply from OpenAI', async () => {
    createMock.mockResolvedValueOnce(reply('{"ok":true}'));
    await expect(callAI({ prompt: 'x', schema })).resolves.toEqual({ ok: true });
  });

  it('retries once then throws on persistently invalid output', async () => {
    createMock.mockResolvedValue(reply('not json'));
    await expect(callAI({ prompt: 'x', schema })).rejects.toThrow(/validation/i);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
