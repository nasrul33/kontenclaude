import { describe, expect, it } from 'vitest';
import { sanitizeFfmpegPath, UnsafePathError } from '../sanitize.js';

describe('sanitizeFfmpegPath', () => {
  it('accepts a path under the allowed root', () => {
    expect(sanitizeFfmpegPath('/tmp/clipflow/job-1/out.mp4')).toContain('out.mp4');
  });

  it('rejects shell metacharacters', () => {
    expect(() => sanitizeFfmpegPath('/tmp/clipflow/job;rm -rf.mp4')).toThrow(UnsafePathError);
  });

  it('rejects ffmpeg protocol prefixes', () => {
    expect(() => sanitizeFfmpegPath('concat:/etc/passwd|/etc/shadow')).toThrow(UnsafePathError);
  });

  it('rejects relative paths', () => {
    expect(() => sanitizeFfmpegPath('out.mp4')).toThrow(UnsafePathError);
  });

  it('rejects paths escaping the allowed root', () => {
    expect(() => sanitizeFfmpegPath('/etc/passwd')).toThrow(UnsafePathError);
  });
});
