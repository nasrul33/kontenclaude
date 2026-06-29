// Placeholder worker — proves the BullMQ wiring is alive in Phase 0.
// Real workers (ingest, transcribe, segment, render, publish) land in later phases.
import { Worker } from 'bullmq';
import { getRedis } from '../lib/redis.js';

export function startHealthWorker(): Worker {
  return new Worker(
    'health',
    async job => {
      return { ok: true, jobId: job.id, ranAt: new Date().toISOString() };
    },
    { connection: getRedis() },
  );
}
