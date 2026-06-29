import { describe, expect, it, vi } from 'vitest';

// Adapters import prisma.ts which calls loadEnv() at module load — set env BEFORE
// imports run. vi.hoisted is lifted above the import statements by vitest.
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/x';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.MINIO_ACCESS_KEY = 'x';
  process.env.MINIO_SECRET_KEY = 'x';
  process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.SESSION_COOKIE_SECRET = '0123456789abcdef0123';
  process.env.ANTHROPIC_API_KEY = 'x';
});

import { getAdapter, needsVideoUrl } from '../registry.js';
import { PlatformSchema } from '@clipflow/shared';

describe('adapter registry', () => {
  it('resolves an adapter for every Platform enum value', () => {
    for (const platform of PlatformSchema.options) {
      const adapter = getAdapter(platform);
      expect(adapter.platform).toBe(platform);
    }
  });

  it('flags URL-ingest platforms', () => {
    expect(needsVideoUrl('INSTAGRAM')).toBe(true);
    expect(needsVideoUrl('FACEBOOK')).toBe(true);
    expect(needsVideoUrl('TIKTOK')).toBe(false);
  });
});
