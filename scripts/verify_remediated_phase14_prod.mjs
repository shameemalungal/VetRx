import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('VETRX PHASE 14 — PRODUCTION INVITATION FIX VERIFICATION AUDIT');
  console.log('===============================================================');

  const ownerEmail = 'drshameemalungal@gmail.com';
  const invitedEmail = 'shameem.sgs2@gmail.com';

  // 1. Practice Query
  const practice = await prisma.practice.findFirst({
    where: {
      owner: { email: ownerEmail },
    },
    include: {
      owner: true,
      members: {
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      },
      invitations: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!practice) {
    throw new Error(`Practice for owner ${ownerEmail} not found!`);
  }

  console.log('\n--- 1. Practice Verification ---');
  console.log('Practice ID:', practice.id);
  console.log('Practice Name:', practice.name);
  console.log('Practice Owner:', practice.owner.email, `(${practice.owner.name})`);

  console.log('\n--- 2. Practice Members Verification ---');
  console.log(`Total Members: ${practice.members.length}`);
  practice.members.forEach((m, idx) => {
    console.log(`[Member ${idx + 1}] ${m.user.name} <${m.user.email}>`);
    console.log(`  Role: ${m.role}`);
    console.log(`  Active: ${m.isActive}`);
    console.log(`  Joined: ${m.createdAt.toISOString()}`);
  });

  const staffMember = practice.members.find(m => m.user.email === invitedEmail);
  if (!staffMember) {
    console.error(`❌ FAILURE: ${invitedEmail} is NOT a member of ${practice.name}`);
  } else if (staffMember.role !== 'STAFF') {
    console.error(`❌ FAILURE: ${invitedEmail} role is ${staffMember.role}, expected STAFF`);
  } else {
    console.log(`\n✅ PASS: ${invitedEmail} is correctly listed as STAFF in ${practice.name}`);
  }

  // 3. Verify Invited User State
  console.log('\n--- 3. Invited User Profile & Practice Context ---');
  const invitedUser = await prisma.user.findUnique({
    where: { email: invitedEmail },
    include: {
      ownedPractices: true,
      memberships: { include: { practice: true } },
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  console.log('User Name:', invitedUser?.name);
  console.log('User Email:', invitedUser?.email);
  console.log('Owned Practices Count:', invitedUser?.ownedPractices.length);
  if (invitedUser?.ownedPractices.length === 0) {
    console.log('✅ PASS: Invited user owns 0 practices (dummy practice completely removed).');
  } else {
    console.error('❌ WARNING: User still owns practice(s):', invitedUser?.ownedPractices.map(p => p.name));
  }

  console.log('\nUser Memberships:');
  invitedUser?.memberships.forEach(m => {
    console.log(`  - Practice: "${m.practice.name}" | Role: ${m.role} | Active: ${m.isActive}`);
  });

  console.log('\nActive Sessions:');
  invitedUser?.sessions.forEach((s, idx) => {
    console.log(`  - [Session ${idx + 1}] ID: ${s.id} | PracticeId: ${s.practiceId} | Expires: ${s.expiresAt.toISOString()}`);
    if (s.practiceId === practice.id) {
      console.log(`    ✅ Active session practice context is correctly set to ${practice.name}`);
    } else {
      console.log(`    ⚠️ Session practice context: ${s.practiceId}`);
    }
  });

  // 4. Invitation History
  console.log('\n--- 4. Invitation History ---');
  practice.invitations.forEach((inv, idx) => {
    console.log(`[Invite ${idx + 1}] ID: ${inv.id} | Email: ${inv.email} | Role: ${inv.role} | Status: ${inv.status} | AcceptedAt: ${inv.acceptedAt}`);
  });

  const latestAccepted = practice.invitations.find(i => i.email === invitedEmail && i.status === 'ACCEPTED');
  if (latestAccepted) {
    console.log(`\n✅ PASS: Latest invitation for ${invitedEmail} is marked ACCEPTED.`);
  }

  // 5. Check No Dangling Orphan Dummy Practice Exists
  console.log('\n--- 5. Orphan Practice Check ---');
  const dummyCheck = await prisma.practice.findUnique({
    where: { id: 'fd7eec19-1803-45a4-9f70-5d633048e8a7' },
  });
  if (!dummyCheck) {
    console.log('✅ PASS: Dummy practice "Shameem A\'s Practice" (fd7eec19-1803-45a4-9f70-5d633048e8a7) is confirmed deleted.');
  } else {
    console.error('❌ WARNING: Dummy practice still exists in database!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
