import { join } from 'node:path';
import { defineWorker } from './runner.js';
import {
  enqueue,
  transcribeQueue,
  idempotentJobId,
  type ProjectJob,
} from './queues.js';
import { prisma } from '../lib/prisma.js';
import { withTmpDir } from '../lib/fs-temp.js';
import { downloadFile, bucketFor } from '../storage/minio.js';
import { probeVideo } from '../ffmpeg/index.js';

// Download source from MinIO, probe metadata, record duration, hand off to transcribe.
export function startIngestWorker() {
  return defineWorker<ProjectJob>('ingest', async job => {
    const { projectId } = job.data;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    await prisma.project.update({ where: { id: projectId }, data: { status: 'PROCESSING' } });

    try {
      if (!project.storagePath) throw new Error('project has no source storagePath');
      const meta = await withTmpDir(job.id ?? projectId, async dir => {
        const src = join(dir, 'source');
        await downloadFile(bucketFor('sources'), project.storagePath as string, src);
        return probeVideo(src);
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { durationSec: Math.round(meta.durationSec) },
      });

      await enqueue<ProjectJob>(
        transcribeQueue,
        'TRANSCRIBE',
        { projectId },
        idempotentJobId('TRANSCRIBE', projectId),
      );
    } catch (err) {
      await prisma.project.update({ where: { id: projectId }, data: { status: 'FAILED' } });
      throw err;
    }
  });
}
