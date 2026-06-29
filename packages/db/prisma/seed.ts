import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '../generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL missing for seed');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'dev@clipflow.local' },
    update: {},
    create: {
      email: 'dev@clipflow.local',
      emailVerified: true,
      name: 'Dev User',
      plan: 'PRO',
    },
  });
  console.log('Seeded user:', user.email);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
