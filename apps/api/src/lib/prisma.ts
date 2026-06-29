// Prisma 7 — datasource url is no longer in schema.prisma; runtime uses a driver adapter.
import { PrismaClient } from '@clipflow/db';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function buildClient(): PrismaClient {
  const env = loadEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = global.__prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
