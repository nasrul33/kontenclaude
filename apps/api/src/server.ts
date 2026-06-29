import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { loadEnv } from './lib/env.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { getAuth } from './plugins/auth.js';

const env = loadEnv();

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    // CLAUDE.md invariant #6 — never log secrets.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.secret',
        '*.password',
        '*.apiKey',
        '*.ANTHROPIC_API_KEY',
      ],
      censor: '[redacted]',
    },
  },
});

await app.register(cors, { origin: env.APP_URL, credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
// 500MB cap mirrors the nginx upload limit; magic-bytes still enforced per file.
await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024, files: 1 } });

await app.register(healthRoutes);
await app.register(projectRoutes);

// Better Auth handler — mount under /api/auth/*
const auth = getAuth();
app.all('/api/auth/*', async (req, reply) => {
  const url = new URL(req.url, env.APP_URL);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body);
  }
  const request = new Request(url, init);
  const response = await auth.handler(request);
  reply.status(response.status);
  response.headers.forEach((val, key) => reply.header(key, val));
  return response.body ? await response.text() : '';
});

const port = env.PORT;
try {
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`ClipFlow API listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
