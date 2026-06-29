import { Redis } from 'ioredis';

// Shared Redis connection for BullMQ
// BullMQ requires maxRetriesPerRequest: null
export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('error', err => {
  process.stderr.write(`Redis error: ${err.message}\n`);
});
