// ==============================================================================
// VetRx Database Seed Script (Idempotent)
// ==============================================================================

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding VetRx database...');

  const demoEmail = 'doctor@vetrx.local';
  const normalizedEmail = demoEmail.toLowerCase().trim();

  // Check if demo user already exists
  const existingUser = await prisma.user.findUnique({
    where: { normalizedEmail },
  });

  if (existingUser) {
    console.log(`Demo user (${demoEmail}) already exists. Skipping creation.`);
    return;
  }

  const passwordHash = await bcrypt.hash('VetRxDoctor2026!', 12);

  // Run atomic transaction to create user, practice, membership, settings
  await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        email: demoEmail,
        normalizedEmail,
        name: 'Dr. Ahmed Kumar',
        emailVerified: true,
        passwordHash,
      },
    });

    // 2. Create AuthIdentity
    await tx.authIdentity.create({
      data: {
        userId: user.id,
        provider: 'password',
        providerUserId: normalizedEmail,
        providerEmail: demoEmail,
      },
    });

    // 3. Create Default Practice
    const practice = await tx.practice.create({
      data: {
        name: 'Companion Care Veterinary Clinic',
        slug: 'companion-care',
        ownerUserId: user.id,
      },
    });

    // 4. Create Practice Membership as OWNER
    await tx.practiceMember.create({
      data: {
        practiceId: practice.id,
        userId: user.id,
        role: Role.PRACTICE_OWNER,
      },
    });

    // 5. Create Practice Settings
    await tx.practiceSettings.create({
      data: {
        practiceId: practice.id,
        clinicName: 'Companion Care Veterinary Clinic',
        doctorName: 'Dr. Ahmed Kumar, BVSc & AH',
        doctorRegistrationNumber: 'KVC-7842',
        phone: '+91 98470 12345',
        email: 'care@companionvet.in',
        address: 'Malappuram, Kerala, India - 676505',
        ownerSpecialInstructionEnabled: true,
      },
    });

    // 6. Initialize Document Sequences
    const currentYear = new Date().getFullYear();
    await tx.documentSequence.createMany({
      data: [
        { practiceId: practice.id, docType: 'PRESCRIPTION', year: currentYear, lastNumber: 892 },
        { practiceId: practice.id, docType: 'INVOICE', year: currentYear, lastNumber: 125 },
        { practiceId: practice.id, docType: 'RECEIPT', year: currentYear, lastNumber: 42 },
      ],
    });

    console.log('Successfully created demo user and practice:');
    console.log(`- Email: ${demoEmail}`);
    console.log(`- Practice: ${practice.name}`);
  });
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
