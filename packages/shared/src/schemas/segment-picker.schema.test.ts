import { describe, expect, it } from 'vitest';
import { SegmentResultSchema } from './segment-picker.schema.js';

describe('SegmentResultSchema', () => {
  it('accepts a valid AI output', () => {
    const ok = SegmentResultSchema.safeParse({
      segments: [
        { startSec: 10, endSec: 25, score: 8.4, reason: 'punchline lands here', hookPreview: 'wait until you see this' },
      ],
      langDetected: 'id',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects langDetected with wrong length', () => {
    const bad = SegmentResultSchema.safeParse({
      segments: [
        { startSec: 0, endSec: 10, score: 5, reason: 'r', hookPreview: 'h' },
      ],
      langDetected: 'eng',
    });
    expect(bad.success).toBe(false);
  });

  it('requires at least one segment', () => {
    const bad = SegmentResultSchema.safeParse({ segments: [], langDetected: 'id' });
    expect(bad.success).toBe(false);
  });
});
