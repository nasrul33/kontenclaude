import { join } from 'node:path';
import { defineWorker } from './runner.js';
import type { PublishJob } from './queues.js';
import { prisma } from '../lib/prisma.js';
import { withTmpDir } from '../lib/fs-temp.js';
import { downloadFile, presignedGet, bucketFor } from '../storage/minio.js';
import { getAdapter, needsVideoUrl } from '../social/registry.js';
import { PlatformSchema, type Platform } from '@clipflow/shared';

// Publish a rendered clip to one platform. Publication lifecycle: PUBLISHING → PUBLISHED/FAILED.
export function startPublishWorker() {
  return defineWorker<PublishJob>(
    'publish',
    async job => {
      const { clipId } = job.data;
      const platform = PlatformSchema.parse(job.data.platform) as Platform;

      const clip = await prisma.clip.findUniqueOrThrow({
        where: { id: clipId },
        include: { project: true, captions: true },
      });

      // Find the pending/scheduled publication row, or create one.
      let pub = await prisma.publication.findFirst({
        where: { clipId, platform, status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] } },
        orderBy: { createdAt: 'desc' },
      });
      pub ??= await prisma.publication.create({ data: { clipId, platform, status: 'PENDING' } });
      await prisma.publication.update({ where: { id: pub.id }, data: { status: 'PUBLISHING' } });

      try {
        if (clip.status !== 'READY' || !clip.storagePath) {
          throw new Error('clip is not rendered (status != READY)');
        }
        const account = await prisma.socialAccount.findUnique({
          where: { userId_platform: { userId: clip.project.userId, platform } },
        });
        if (!account) throw new Error(`no ${platform} account connected`);

        const caption = clip.captions.find(c => c.platform === platform);
        if (!caption) throw new Error(`no ${platform} caption generated`);

        const result = await withTmpDir(job.id ?? `${clipId}-${platform}`, async dir => {
          const video = join(dir, 'final.mp4');
          await downloadFile(bucketFor('clips'), clip.storagePath as string, video);
          const videoUrl = needsVideoUrl(platform)
            ? await presignedGet(bucketFor('clips'), clip.storagePath as string, 3600)
            : undefined;
          return getAdapter(platform).publish(account, {
            videoPath: video,
            ...(videoUrl ? { videoUrl } : {}),
            caption: caption.body,
            hashtags: caption.hashtags,
            ...(caption.title ? { title: caption.title } : {}),
          });
        });

        await prisma.publication.update({
          where: { id: pub.id },
          data: {
            status: 'PUBLISHED',
            platformPostId: result.platformPostId,
            publishedAt: new Date(),
            errorMsg: null,
          },
        });
      } catch (err) {
        await prisma.publication.update({
          where: { id: pub.id },
          data: { status: 'FAILED', errorMsg: err instanceof Error ? err.message : String(err) },
        });
        throw err;
      }
    },
    3,
  );
}
