import { PrismaClient } from '../generated';

const prisma = new PrismaClient();

async function main() {
  // Seed dev user
  const user = await prisma.user.upsert({
    where: { email: 'dev@clipflow.local' },
    update: {},
    create: {
      email: 'dev@clipflow.local',
      name:  'Dev User',
      plan:  'PRO',
    },
  });
  console.log('Seeded user:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
