import { describe, expect, it } from 'vitest';
import { needsRefresh, expiresAtFrom } from '../token-policy.js';
import { assertDurationWithinLimit, assertFileWithinLimit } from '../constraints.js';
import { withHashtags } from '../base.adapter.js';
import { PlatformConstraintError } from '@clipflow/shared';

describe('token policy', () => {
  const now = 1_000_000_000_000;
  it('never refreshes when no expiry', () => {
    expect(needsRefresh(null, 300_000, now)).toBe(false);
  });
  it('refreshes within the skew window', () => {
    expect(needsRefresh(new Date(now + 60_000), 300_000, now)).toBe(true);
  });
  it('does not refresh when comfortably valid', () => {
    expect(needsRefresh(new Date(now + 3_600_000), 300_000, now)).toBe(false);
  });
  it('expiresAtFrom returns null without expiresIn', () => {
    expect(expiresAtFrom(undefined, now)).toBeNull();
    expect(expiresAtFrom(3600, now)?.getTime()).toBe(now + 3_600_000);
  });
});

describe('platform constraints', () => {
  it('YouTube rejects > 60s', () => {
    expect(() => assertDurationWithinLimit('YOUTUBE', 61)).toThrow(PlatformConstraintError);
    expect(() => assertDurationWithinLimit('YOUTUBE', 60)).not.toThrow();
  });
  it('Facebook rejects > 90s', () => {
    expect(() => assertDurationWithinLimit('FACEBOOK', 91)).toThrow(PlatformConstraintError);
  });
  it('TikTok rejects oversize files', () => {
    expect(() => assertFileWithinLimit('TIKTOK', 300_000_000)).toThrow(PlatformConstraintError);
    expect(() => assertFileWithinLimit('TIKTOK', 1000)).not.toThrow();
  });
});

describe('withHashtags', () => {
  it('appends normalized hashtags', () => {
    expect(withHashtags('hi', ['a', '#b'])).toBe('hi\n\n#a #b');
  });
  it('returns caption unchanged with no hashtags', () => {
    expect(withHashtags('hi', [])).toBe('hi');
  });
});
