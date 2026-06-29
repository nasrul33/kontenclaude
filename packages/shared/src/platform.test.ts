import { describe, expect, it } from 'vitest';
import { PLATFORM_LIMITS, PlatformSchema } from './platform.js';

describe('platform constraints', () => {
  it('YouTube Shorts cap = 60s (CLAUDE.md invariant)', () => {
    expect(PLATFORM_LIMITS.YOUTUBE.maxDurationSec).toBe(60);
  });

  it('Facebook Reels cap = 90s (CLAUDE.md invariant)', () => {
    expect(PLATFORM_LIMITS.FACEBOOK.maxDurationSec).toBe(90);
  });

  it('Platform enum covers all five targets', () => {
    expect(PlatformSchema.options.sort()).toEqual(
      ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'YOUTUBE'].sort(),
    );
  });
});
