import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { defineWorker } from './runner.js';
import type { ClipJob } from './queues.js';
import { prisma } from '../lib/prisma.js';
import { withTmpDir } from '../lib/fs-temp.js';
import { downloadFile, uploadFile, bucketFor, objectKeys } from '../storage/minio.js';
import { trim, reframe, burnSubtitle, extractThumbnail } from '../ffmpeg/index.js';
import { clipSrt, type TranscriptSegment } from '../transcription/srt.js';

async function maybeMarkProjectDone(projectId: string) {
  const pending = await prisma.clip.count({
    where: { projectId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (pending === 0) {
    await prisma.project.update({ where: { id: projectId }, data: { status: 'DONE' } });
  }
}

// Trim → reframe 9:16 → burn subtitle → thumbnail → upload → mark READY.
export function startRenderWorker() {
  return defineWorker<ClipJob>(
    'render',
    async job => {
      const { clipId } = job.data;
      const clip = await prisma.clip.findUniqueOrThrow({
        where: { id: clipId },
        include: { project: true },
      });
      const project = clip.project;
      const userId = project.userId;

      await prisma.clip.update({ where: { id: clipId }, data: { status: 'PROCESSING' } });

      try {
        if (!project.storagePath) throw new Error('project has no source storagePath');

        const keys = await withTmpDir(job.id ?? clipId, async dir => {
          const src = join(dir, 'source');
          await downloadFile(bucketFor('sources'), project.storagePath as string, src);

          const jsonPath = join(dir, 'transcript.json');
          await downloadFile(
            bucketFor('sources'),
            objectKeys.transcriptJson(userId, project.id),
            jsonPath,
          );
          const segments = JSON.parse(await readFile(jsonPath, 'utf8')) as TranscriptSegment[];

          const trimmed = join(dir, 'trim.mp4');
          await trim(src, trimmed, clip.startSec, clip.endSec);

          const reframed = join(dir, 'reframe.mp4');
          await reframe(trimmed, reframed, clip.aspect);

          const srtPath = join(dir, 'clip.srt');
          await writeFile(srtPath, clipSrt(segments, clip.startSec, clip.endSec), 'utf8');

          const subtitled = join(dir, 'final.mp4');
          await burnSubtitle(reframed, subtitled, srtPath);

          const thumb = join(dir, 'thumb.jpg');
          await extractThumbnail(subtitled, thumb, Math.max(0, (clip.endSec - clip.startSec) / 2));

          const finalKey = objectKeys.clipFinal(userId, project.id, clipId);
          const thumbKey = objectKeys.thumb(userId, project.id, clipId);
          const srtKey = objectKeys.srt(userId, project.id, clipId);
          await uploadFile(bucketFor('clips'), finalKey, subtitled, 'video/mp4');
          await uploadFile(bucketFor('thumbnails'), thumbKey, thumb, 'image/jpeg');
          await uploadFile(bucketFor('srt'), srtKey, srtPath, 'application/x-subrip');

          return { finalKey, thumbKey, srtKey };
        });

        await prisma.clip.update({
          where: { id: clipId },
          data: {
            status: 'READY',
            storagePath: keys.finalKey,
            thumbPath: keys.thumbKey,
            srtPath: keys.srtKey,
          },
        });
        await maybeMarkProjectDone(project.id);
      } catch (err) {
        await prisma.clip.update({ where: { id: clipId }, data: { status: 'FAILED' } });
        throw err;
      }
    },
    4,
  );
}
