import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PlatformSchema } from '@clipflow/shared';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/session.js';
import {
  publishQueue,
  enqueue,
  idempotentJobId,
  type PublishJob,
} from '../jobs/queues.js';

const PublishBody = z.object({
  platforms: z.array(PlatformSchema).min(1),
  scheduledFor: z.string().datetime().optional(),
});

export async function publishRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/api/v1/clips/:id/publish', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const parsed = PublishBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid body', issues: parsed.error.issues });
    }
    const { platforms, scheduledFor } = parsed.data;

    const clip = await prisma.clip.findFirst({
      where: { id: req.params.id, project: { userId: user.id } },
    });
    if (!clip) return reply.code(404).send({ error: 'clip not found' });
    if (clip.status !== 'READY') {
      return reply.code(409).send({ error: `clip not ready (status ${clip.status})` });
    }

    const scheduledForDate = scheduledFor ? new Date(scheduledFor) : null;
    const delayMs = scheduledForDate ? Math.max(0, scheduledForDate.getTime() - Date.now()) : 0;

    const results = [];
    for (const platform of platforms) {
      const pub = await prisma.publication.create({
        data: {
          clipId: clip.id,
          platform,
          status: scheduledForDate ? 'SCHEDULED' : 'PENDING',
          scheduledFor: scheduledForDate,
        },
      });
      await enqueue<PublishJob>(
        publishQueue,
        'PUBLISH',
        { clipId: clip.id, platform },
        idempotentJobId('PUBLISH', clip.id, platform),
        { delayMs },
      );
      results.push({ publicationId: pub.id, platform, status: pub.status });
    }

    return reply.code(202).send({ clipId: clip.id, publications: results });
  });
}
