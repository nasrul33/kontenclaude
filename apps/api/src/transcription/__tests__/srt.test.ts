import { describe, expect, it } from 'vitest';
import {
  formatSrtTimestamp,
  segmentsToSrt,
  segmentsToPlainText,
  sliceSegments,
  rebaseSegments,
  clipSrt,
} from '../srt.js';

describe('srt', () => {
  it('formats timestamps as HH:MM:SS,mmm', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(3661.5)).toBe('01:01:01,500');
    expect(formatSrtTimestamp(2.4)).toBe('00:00:02,400');
  });

  it('builds a valid SRT block sequence', () => {
    const srt = segmentsToSrt([
      { start: 0, end: 2, text: 'Halo semua' },
      { start: 2, end: 4.5, text: 'Selamat datang' },
    ]);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,000\nHalo semua');
    expect(srt).toContain('2\n00:00:02,000 --> 00:00:04,500\nSelamat datang');
  });

  it('returns empty string for no segments', () => {
    expect(segmentsToSrt([])).toBe('');
  });

  it('joins plain text', () => {
    expect(
      segmentsToPlainText([
        { start: 0, end: 1, text: 'a' },
        { start: 1, end: 2, text: 'b' },
      ]),
    ).toBe('a b');
  });

  const full = [
    { start: 0, end: 5, text: 'intro' },
    { start: 5, end: 10, text: 'middle' },
    { start: 10, end: 15, text: 'end' },
  ];

  it('sliceSegments keeps only overlapping windows, clipped', () => {
    const sliced = sliceSegments(full, 6, 12);
    expect(sliced).toEqual([
      { start: 6, end: 10, text: 'middle' },
      { start: 10, end: 12, text: 'end' },
    ]);
  });

  it('rebaseSegments shifts to zero and floors at 0', () => {
    expect(rebaseSegments([{ start: 6, end: 10, text: 'x' }], 5)).toEqual([
      { start: 1, end: 5, text: 'x' },
    ]);
  });

  it('clipSrt produces a zero-based clip subtitle', () => {
    const srt = clipSrt(full, 5, 15);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:05,000\nmiddle');
    expect(srt).toContain('2\n00:00:05,000 --> 00:00:10,000\nend');
  });
});
