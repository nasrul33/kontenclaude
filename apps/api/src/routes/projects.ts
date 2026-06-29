import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { fileTypeFromFile } from 'file-type';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/session.js';
import { TMP_ROOT } from '../lib/fs-temp.js';
import { uploadFile, presignedGet, bucketFor, objectKeys } from '../storage/minio.js';
import { ingestQueue, enqueue, idempotentJobId, type ProjectJob } from '../jobs/queues.js';

const ALLOWED_VIDEO_MIME = /^video\//;

export async function projectRoutes(app: FastifyInstance) {
  // ── Upload a source video → create Project → enqueue ingest ──────────────
  app.post('/api/v1/projects', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'no file uploaded' });

    const title =
      typeof data.fields.title === 'object' &&
      data.fields.title &&
      'value' in data.fields.title &&
      typeof data.fields.title.value === 'string'
        ? data.fields.title.value
        : data.filename;

    const stageDir = join(TMP_ROOT, 'uploads');
    const stagePath = join(stageDir, randomUUID());
    await mkdir(stageDir, { recursive: true });

    try {
      // Stream to disk first so we can magic-byte check before trusting it.
      await pipeline(data.file, createWriteStream(stagePath));
      if (data.file.truncated) {
        return reply.code(413).send({ error: 'file exceeds size limit' });
      }

      // CLAUDE.md invariant #11 — verify by magic bytes, NOT Content-Type header.
      const ft = await fileTypeFromFile(stagePath);
      if (!ft || !ALLOWED_VIDEO_MIME.test(ft.mime)) {
        return reply.code(415).send({ error: `unsupported file type: ${ft?.mime ?? 'unknown'}` });
      }

      const project = await prisma.project.create({
        data: { userId: user.id, title, status: 'PENDING' },
      });

      const key = objectKeys.source(user.id, project.id, `source.${ft.ext}`);
      await uploadFile(bucketFor('sources'), key, stagePath, ft.mime);
      await prisma.project.update({ where: { id: project.id }, data: { storagePath: key } });

      await enqueue<ProjectJob>(
        ingestQueue,
        'INGEST',
        { projectId: project.id },
        idempotentJobId('INGEST', project.id),
      );

      return reply.code(201).send({ id: project.id, title: project.title, status: 'PENDING' });
    } finally {
      await rm(stagePath, { force: true });
    }
  });

  // ── List the caller's projects ───────────────────────────────────────────
  app.get('/api/v1/projects', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        durationSec: true,
        createdAt: true,
        _count: { select: { clips: true } },
      },
    });
    return projects.map(p => ({ ...p, clipCount: p._count.clips, _count: undefined }));
  });

  // ── One project + its clips (with presigned URLs when READY) ─────────────
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: { clips: { orderBy: { score: 'desc' } } },
    });
    if (!project) return reply.code(404).send({ error: 'not found' });

    const clips = await Promise.all(
      project.clips.map(async clip => ({
        id: clip.id,
        startSec: clip.startSec,
        endSec: clip.endSec,
        score: clip.score,
        status: clip.status,
        aspect: clip.aspect,
        videoUrl:
          clip.status === 'READY' && clip.storagePath
            ? await presignedGet(bucketFor('clips'), clip.storagePath)
            : null,
        thumbUrl: clip.thumbPath
          ? await presignedGet(bucketFor('thumbnails'), clip.thumbPath)
          : null,
      })),
    );

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      durationSec: project.durationSec,
      createdAt: project.createdAt,
      clips,
    };
  });
}
