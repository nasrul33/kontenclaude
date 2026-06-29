import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  app.get('/health/deep', async (req, reply) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { ok: true };
    } catch (e) {
      checks.postgres = { ok: false, error: (e as Error).message };
    }

    try {
      const pong = await getRedis().ping();
      checks.redis = { ok: pong === 'PONG' };
    } catch (e) {
      checks.redis = { ok: false, error: (e as Error).message };
    }

    const allOk = Object.values(checks).every(c => c.ok);
    if (!allOk) reply.code(503);
    return { status: allOk ? 'ok' : 'degraded', checks };
  });
}
