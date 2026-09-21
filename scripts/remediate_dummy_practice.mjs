import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dummyPracticeId = 'fd7eec19-1803-45a4-9f70-5d633048e8a7';
  const realPracticeId = 'f199a58c-c794-491b-89e1-e71453de389b';
  const invitedUserId = '7564adb4-0916-4cdd-80ff-28875ea77ae9'; // shameem.sgs2@gmail.com

  console.log('=== 1. VERIFYING DUMMY PRACTICE DATA ===');
  const dummyPractice = await prisma.practice.findUnique({
    where: { id: dummyPracticeId },
    include: {
      members: true,
      settings: true,
      subscriptions: true,
    }
  });
  console.log('Dummy practice found:', dummyPractice ? dummyPractice.name : 'NOT FOUND');

  if (dummyPractice) {
    // Check all clinical entities for dummy practice
    const ownerCount = await prisma.owner.count({ where: { practiceId: dummyPracticeId } });
    const patientCount = await prisma.patient.count({ where: { practiceId: dummyPracticeId } });
    const invoiceCount = await prisma.invoice.count({ where: { practiceId: dummyPracticeId } });
    const presCount = await prisma.prescription.count({ where: { practiceId: dummyPracticeId } });
    const medicineCount = await prisma.medicine.count({ where: { practiceId: dummyPracticeId } });
    const receiptCount = await prisma.receipt.count({ where: { practiceId: dummyPracticeId } });

    console.log({
      ownerCount,
      patientCount,
      invoiceCount,
      presCount,
      medicineCount,
      receiptCount,
      members: dummyPractice.members.length,
    });

    if (ownerCount > 0 || patientCount > 0 || invoiceCount > 0 || presCount > 0 || medicineCount > 0 || receiptCount > 0) {
      throw new Error('DANGER: Dummy practice contains clinical data! Aborting remediation.');
    }
  }

  console.log('\n=== 2. VERIFYING REAL PRACTICE & INVITATION ===');
  const realPractice = await prisma.practice.findUnique({
    where: { id: realPracticeId },
    include: { members: { include: { user: true } } }
  });
  console.log('Real practice:', realPractice?.name);
  console.log('Existing members:', realPractice?.members.map(m => `${m.user.email} (${m.role})`));

  const invitations = await prisma.practiceInvitation.findMany({
    where: {
      email: 'shameem.sgs2@gmail.com',
      practiceId: realPracticeId,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Invitations found:', invitations.map(i => ({ id: i.id, token: i.token, status: i.status, role: i.role, createdAt: i.createdAt })));

  const latestPendingOrRecentInvite = invitations.find(i => i.status === 'PENDING') || invitations[0];

  console.log('\n=== 3. EXECUTING REMEDIATION IN TRANSACTION ===');
  await prisma.$transaction(async (tx) => {
    // A. Ensure user is a member of the real practice with role STAFF
    const existingRealMember = await tx.practiceMember.findUnique({
      where: {
        practiceId_userId: {
          practiceId: realPracticeId,
          userId: invitedUserId,
        }
      }
    });

    if (!existingRealMember) {
      console.log('Adding user to real practice as STAFF...');
      await tx.practiceMember.create({
        data: {
          userId: invitedUserId,
          practiceId: realPracticeId,
          role: 'STAFF',
          isActive: true,
        }
      });
    } else {
      console.log('Updating user membership in real practice to STAFF, isActive: true...');
      await tx.practiceMember.update({
        where: { id: existingRealMember.id },
        data: {
          role: 'STAFF',
          isActive: true,
        }
      });
    }

    // B. Mark invitation as ACCEPTED
    if (latestPendingOrRecentInvite && latestPendingOrRecentInvite.status !== 'ACCEPTED') {
      console.log('Marking invitation as ACCEPTED:', latestPendingOrRecentInvite.id);
      await tx.practiceInvitation.update({
        where: { id: latestPendingOrRecentInvite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        }
      });
    }

    // C. Update user sessions to point to real practice
    console.log('Updating sessions to point to real practice...');
    const sessionUpdate = await tx.session.updateMany({
      where: { userId: invitedUserId },
      data: { practiceId: realPracticeId }
    });
    console.log(`Updated ${sessionUpdate.count} sessions.`);

    // D. Remove dummy practice membership, settings, subscription, and practice
    if (dummyPractice) {
      console.log('Cleaning up empty dummy practice...');
      await tx.practiceMember.deleteMany({
        where: { practiceId: dummyPracticeId }
      });
      await tx.practiceSettings.deleteMany({
        where: { practiceId: dummyPracticeId }
      });
      await tx.subscription.deleteMany({
        where: { practiceId: dummyPracticeId }
      });
      await tx.practice.delete({
        where: { id: dummyPracticeId }
      });
      console.log('Dummy practice successfully removed.');
    }
  });

  console.log('\n=== 4. VERIFYING FINAL STATE ===');
  const finalRealPractice = await prisma.practice.findUnique({
    where: { id: realPracticeId },
    include: { members: { include: { user: true } } }
  });
  console.log('Final practice members count:', finalRealPractice?.members.length);
  console.log('Final members list:', finalRealPractice?.members.map(m => ({
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    isActive: m.isActive,
  })));

  const finalInvitedUser = await prisma.user.findUnique({
    where: { id: invitedUserId },
    include: {
      memberships: { include: { practice: true } },
      sessions: true,
    }
  });
  console.log('Invited user memberships:', finalInvitedUser?.memberships.map(m => ({
    practice: m.practice.name,
    role: m.role,
  })));
  console.log('Invited user active session practiceIds:', finalInvitedUser?.sessions.map(s => s.practiceId));
}

main()
  .catch((err) => {
    console.error('Remediation error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
