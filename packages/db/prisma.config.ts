// Load root .env (monorepo) before Prisma reads its config.
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(__dirname, '../../.env') });

import { defineConfig, env } from 'prisma/config';

type Env = { DATABASE_URL: string };

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env<Env>('DATABASE_URL') },
});
