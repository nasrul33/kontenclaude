import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { defineWorker } from './runner.js';
import { enqueue, segmentQueue, idempotentJobId, type ProjectJob } from './queues.js';
import { prisma } from '../lib/prisma.js';
import { withTmpDir } from '../lib/fs-temp.js';
import { downloadFile, uploadFile, bucketFor, objectKeys } from '../storage/minio.js';
import { extractAudio } from '../ffmpeg/index.js';
import { runWhisper } from '../transcription/whisper.js';

// Source → 16kHz WAV → faster-whisper → store segments JSON → hand off to segment.
export function startTranscribeWorker() {
  return defineWorker<ProjectJob>(
    'transcribe',
    async job => {
      const { projectId } = job.data;
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

      try {
        if (!project.storagePath) throw new Error('project has no source storagePath');
        const detectedLang = await withTmpDir(job.id ?? projectId, async dir => {
          const src = join(dir, 'source');
          await downloadFile(bucketFor('sources'), project.storagePath as string, src);

          const wav = join(dir, 'audio.wav');
          await extractAudio(src, wav);

          const result = await runWhisper(wav, project.langCode ?? undefined);

          const jsonPath = join(dir, 'transcript.json');
          await writeFile(jsonPath, JSON.stringify(result.segments), 'utf8');
          await uploadFile(
            bucketFor('sources'),
            objectKeys.transcriptJson(project.userId, projectId),
            jsonPath,
            'application/json',
          );
          return result.language;
        });

        if (!project.langCode && detectedLang) {
          await prisma.project.update({
            where: { id: projectId },
            data: { langCode: detectedLang },
          });
        }

        await enqueue<ProjectJob>(
          segmentQueue,
          'SEGMENT',
          { projectId },
          idempotentJobId('SEGMENT', projectId),
        );
      } catch (err) {
        await prisma.project.update({ where: { id: projectId }, data: { status: 'FAILED' } });
        throw err;
      }
    },
    1, // whisper is CPU/GPU heavy — one at a time
  );
}
