// BullMQ worker entry. Run in its own process (`pnpm worker:dev`).
import { loadEnv } from './lib/env.js';
import { ensureBuckets } from './storage/minio.js';
import { startHealthWorker } from './jobs/health.worker.js';
import { startIngestWorker } from './jobs/ingest.worker.js';
import { startTranscribeWorker } from './jobs/transcribe.worker.js';
import { startSegmentWorker } from './jobs/segment.worker.js';
import { startRenderWorker } from './jobs/render.worker.js';

loadEnv(); // validate env up-front; throws if anything is missing
await ensureBuckets();

const workers = [
  startHealthWorker(),
  startIngestWorker(),
  startTranscribeWorker(),
  startSegmentWorker(),
  startRenderWorker(),
];
process.stderr.write(`[worker] started ${workers.length} worker(s)\n`);

async function shutdown() {
  process.stderr.write('[worker] shutting down...\n');
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
