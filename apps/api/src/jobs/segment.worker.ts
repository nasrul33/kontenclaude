import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { defineWorker } from './runner.js';
import { enqueue, renderQueue, idempotentJobId, type ProjectJob, type ClipJob } from './queues.js';
import { prisma } from '../lib/prisma.js';
import { withTmpDir } from '../lib/fs-temp.js';
import { downloadFile, bucketFor, objectKeys } from '../storage/minio.js';
import {
  segmentsToSrt,
  segmentsToPlainText,
  sliceSegments,
  type TranscriptSegment,
} from '../transcription/srt.js';
import { pickSegments } from '../ai/segment-picker.js';
import { generateCaption } from '../ai/caption-gen.js';
import type { Platform } from '@clipflow/shared';

// Captions are pre-generated for these platforms in Phase 1 (no publishing yet).
const DEFAULT_CAPTION_PLATFORMS: Platform[] = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'];

// AI picks clips from the transcript → create Clip + Caption rows → fan out to render.
export function startSegmentWorker() {
  return defineWorker<ProjectJob>(
    'segment',
    async job => {
      const { projectId } = job.data;
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
      const lang = project.langCode ?? 'id';

      try {
        const segments = await withTmpDir(job.id ?? projectId, async dir => {
          const jsonPath = join(dir, 'transcript.json');
          await downloadFile(
            bucketFor('sources'),
            objectKeys.transcriptJson(project.userId, projectId),
            jsonPath,
          );
          return JSON.parse(await readFile(jsonPath, 'utf8')) as TranscriptSegment[];
        });

        const picked = await pickSegments(segmentsToSrt(segments), lang);

        for (const seg of picked.segments) {
          const clip = await prisma.clip.create({
            data: {
              projectId,
              startSec: seg.startSec,
              endSec: seg.endSec,
              score: seg.score,
              status: 'PENDING',
              aspect: 'VERTICAL',
            },
          });

          const clipText = segmentsToPlainText(sliceSegments(segments, seg.startSec, seg.endSec));
          for (const platform of DEFAULT_CAPTION_PLATFORMS) {
            const caption = await generateCaption(platform, clipText, lang);
            await prisma.caption.create({
              data: {
                clipId: clip.id,
                platform,
                body: caption.body,
                hashtags: caption.hashtags,
                title: caption.title ?? null,
                tags: caption.tags ?? [],
              },
            });
          }

          await enqueue<ClipJob>(
            renderQueue,
            'RENDER',
            { clipId: clip.id },
            idempotentJobId('RENDER', clip.id),
          );
        }
      } catch (err) {
        await prisma.project.update({ where: { id: projectId }, data: { status: 'FAILED' } });
        throw err;
      }
    },
    1,
  );
}
