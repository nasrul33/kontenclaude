// Tiny CLI to inspect BullMQ queue counts — invoked via `pnpm worker:inspect`.
import { ingestQueue, transcribeQueue, segmentQueue, renderQueue, publishQueue } from '../jobs/queues.js';

const queues = { ingestQueue, transcribeQueue, segmentQueue, renderQueue, publishQueue };

const snapshot: Record<string, unknown> = {};
for (const [name, q] of Object.entries(queues)) {
  snapshot[name] = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}
console.warn(JSON.stringify(snapshot, null, 2));
process.exit(0);
