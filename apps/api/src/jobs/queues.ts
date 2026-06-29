// BullMQ queues. CLAUDE.md invariant #3: jobId = sha256(type:clipId:platform),
// check for duplicate before enqueue.
import { Queue, type JobsOptions } from 'bullmq';
import { createHash } from 'node:crypto';
import { getRedis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { JobType } from '@clipflow/shared';

const connection = () => ({ connection: getRedis() });

export interface ProjectJob extends Record<string, unknown> {
  projectId: string;
}
export interface ClipJob extends Record<string, unknown> {
  clipId: string;
}
export interface PublishJob extends Record<string, unknown> {
  clipId: string;
  platform: string;
}

export const ingestQueue = new Queue<ProjectJob>('ingest', connection());
export const transcribeQueue = new Queue<ProjectJob>('transcribe', connection());
export const segmentQueue = new Queue<ProjectJob>('segment', connection());
export const renderQueue = new Queue<ClipJob>('render', connection());
export const publishQueue = new Queue<PublishJob>('publish', connection());

export function idempotentJobId(type: JobType, entityId: string, platform = ''): string {
  return createHash('sha256').update(`${type}:${entityId}:${platform}`).digest('hex');
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

/**
 * Enqueue with idempotency + a tracking Job row.
 * Skips if a Job with this bullId already exists (invariant #3).
 */
export async function enqueue<T extends Record<string, unknown>>(
  queue: Queue<T, unknown, string>,
  type: JobType,
  data: T,
  jobId: string,
  opts: { delayMs?: number } = {},
): Promise<void> {
  const existing = await prisma.job.findUnique({ where: { bullId: jobId } });
  if (existing) return;
  await prisma.job.create({
    // payload only ever carries string ids; safe JSON value.
    data: { bullId: jobId, type, payload: data as unknown as Record<string, string>, status: 'QUEUED' },
  });
  const delay = opts.delayMs && opts.delayMs > 0 ? { delay: opts.delayMs } : {};
  // BullMQ's add() uses conditional types (ExtractNameType/ExtractDataType) that are
  // unresolvable while T is generic. Pin to a plain add signature for this one call.
  const q = queue as unknown as {
    add(name: string, data: T, opts: JobsOptions): Promise<unknown>;
  };
  await q.add(type, data, { ...DEFAULT_JOB_OPTS, ...delay, jobId });
}
