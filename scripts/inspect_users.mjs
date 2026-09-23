import { PrismaClient } from '../server/node_modules/@prisma/client/index.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({
    include: {
      memberships: {
        include: { practice: true }
      }
    }
  });
  console.log('Total users:', users.length);
  for (const u of users) {
    console.log(`User: ${u.email} (${u.name}, id: ${u.id}, platformRole: ${u.platformRole})`);
    for (const m of u.memberships) {
      console.log(`  Membership: role=${m.role}, practice=${m.practice.name} (${m.practiceId}), isActive=${m.isActive}`);
    }
  }
}
main().finally(() => p.$disconnect());
