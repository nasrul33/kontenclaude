import { z } from 'zod';

export const PlatformSchema = z.enum(['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'FACEBOOK']);
export type Platform = z.infer<typeof PlatformSchema>;

export const AspectRatioSchema = z.enum(['VERTICAL', 'SQUARE', 'HORIZONTAL']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const ClipStatusSchema = z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']);
export type ClipStatus = z.infer<typeof ClipStatusSchema>;

export const PubStatusSchema = z.enum([
  'PENDING',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
]);
export type PubStatus = z.infer<typeof PubStatusSchema>;

export const JOB_TYPES = [
  'INGEST',
  'TRANSCRIBE',
  'SEGMENT',
  'RENDER',
  'PUBLISH',
  'ANALYTICS',
] as const;
export const JobTypeSchema = z.enum(JOB_TYPES);
export type JobType = z.infer<typeof JobTypeSchema>;

export const JobStatusSchema = z.enum(['QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'DEAD']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// Enforced platform constraints (CLAUDE.md §Platform Constraints).
// Values in SECONDS / BYTES. Pipeline MUST refuse uploads that exceed these.
export const PLATFORM_LIMITS: Record<
  Platform,
  { maxDurationSec: number; maxFileBytes: number; aspectRequired?: AspectRatio }
> = {
  TIKTOK: { maxDurationSec: 600, maxFileBytes: 287_600_000 },
  INSTAGRAM: { maxDurationSec: 900, maxFileBytes: 1_073_741_824 },
  YOUTUBE: { maxDurationSec: 60, maxFileBytes: 256_000_000_000, aspectRequired: 'VERTICAL' },
  TWITTER: { maxDurationSec: 140, maxFileBytes: 512_000_000 },
  FACEBOOK: { maxDurationSec: 90, maxFileBytes: 4_000_000_000 },
};
