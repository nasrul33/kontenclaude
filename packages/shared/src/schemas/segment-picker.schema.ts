import { z } from 'zod';

export const SegmentSchema = z.object({
  startSec:    z.number().min(0),
  endSec:      z.number().min(0).refine(v => v > 0, 'endSec must be > 0'),
  score:       z.number().min(0).max(10),
  reason:      z.string().max(200),
  hookPreview: z.string().max(100),
});

export const SegmentResultSchema = z.object({
  segments:     z.array(SegmentSchema).min(1).max(10),
  langDetected: z.string().length(2),
});

export type Segment       = z.infer<typeof SegmentSchema>;
export type SegmentResult = z.infer<typeof SegmentResultSchema>;
