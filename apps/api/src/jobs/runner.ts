import { Worker, type Job, type Processor } from 'bullmq';
import { getRedis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import type { JobStatus } from '@clipflow/shared';

async function markJob(bullId: string | undefined, status: JobStatus, errorMsg?: string) {
  if (!bullId) return;
  // updateMany so a missing Job row (e.g. health queue) is a no-op, not a throw.
  await prisma.job.updateMany({
    where: { bullId },
    data: { status, errorMsg: errorMsg ?? null, ranAt: new Date() },
  });
}

/**
 * Wrap a handler with standard Job-row lifecycle (ACTIVE → COMPLETED/FAILED) and
 * failure logging. The handler still owns entity-specific status updates
 * (Clip/Project → PROCESSING/READY/FAILED) and MUST re-throw to let BullMQ retry.
 */
export function defineWorker<T>(
  name: string,
  handler: Processor<T>,
  concurrency = 2,
): Worker<T> {
  const worker = new Worker<T>(
    name,
    async (job: Job<T>) => {
      await markJob(job.id, 'ACTIVE');
      try {
        const result = await handler(job, job.token ?? '');
        await markJob(job.id, 'COMPLETED');
        return result;
      } catch (err) {
        await markJob(job.id, 'FAILED', err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    { connection: getRedis(), concurrency },
  );

  worker.on('failed', (job, err) => {
    process.stderr.write(`[${name}] job ${job?.id ?? '?'} failed: ${err.message}\n`);
  });

  return worker;
}
