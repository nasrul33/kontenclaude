import { Redis } from 'ioredis';
import { loadEnv } from './env.js';

// BullMQ requires maxRetriesPerRequest: null on the connection it uses.
let cached: Redis | null = null;

export function getRedis(): Redis {
  if (cached) return cached;
  const env = loadEnv();
  cached = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  cached.on('error', err => {
    process.stderr.write(`Redis error: ${err.message}\n`);
  });
  return cached;
}

// Compatibility export for any code that imports the singleton directly.
export const redis = new Proxy({} as Redis, {
  get(_t, prop) {
    return Reflect.get(getRedis(), prop);
  },
});
