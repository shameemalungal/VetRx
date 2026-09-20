// ==============================================================================
// VetRx Database Seed Script (Idempotent)
// ==============================================================================

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding VetRx database...');

  // 1. Idempotently seed authoritative commercial subscription plans
  console.log('Seeding authoritative commercial subscription plans...');
  const plans = [
    {
      code: 'TRIAL',
      name: '14-Day Free Trial',
      description: 'Full-featured 14-day evaluation with introductory practice limits.',
      interval: 'MONTHLY' as const,
      intervalCount: 1,
      pricePaisa: 0,
      currency: 'INR',
      trialPeriodDays: 14,
      maxUserSeats: 1,
      featuresJson: {
        maxPatients: 10,
        maxRecordsPerPatient: 5,
        maxPackages: 5,
        maxCustomMedicines: 10,
        maxVeterinarianSeats: 1,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
      },
      sortOrder: 0,
    },
    {
      code: 'INDIVIDUAL_MONTHLY',
      name: 'Individual (Monthly)',
      description: 'Single veterinarian private practice with unlimited patients.',
      interval: 'MONTHLY' as const,
      intervalCount: 1,
      pricePaisa: 59900,
      currency: 'INR',
      trialPeriodDays: 0,
      maxUserSeats: 1,
      featuresJson: {
        maxVeterinarianSeats: 1,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
      },
      sortOrder: 1,
    },
    {
      code: 'INDIVIDUAL_ANNUAL',
      name: 'Individual (Annual)',
      description: 'Single veterinarian private practice. Save ₹1,189/year with annual billing.',
      interval: 'ANNUAL' as const,
      intervalCount: 1,
      pricePaisa: 599900,
      currency: 'INR',
      trialPeriodDays: 0,
      maxUserSeats: 1,
      featuresJson: {
        maxVeterinarianSeats: 1,
        annualSavingsPaisa: 118900,
        savingsPercentage: 16.6,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
      },
      sortOrder: 2,
    },
    {
      code: 'CLINIC_MONTHLY',
      name: 'Clinic (Monthly)',
      description: 'Multi-doctor clinic supporting up to 5 veterinarians and unlimited staff.',
      interval: 'MONTHLY' as const,
      intervalCount: 1,
      pricePaisa: 149900,
      currency: 'INR',
      trialPeriodDays: 0,
      maxUserSeats: 5,
      featuresJson: {
        maxVeterinarianSeats: 5,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
        multiUserCollaboration: true,
      },
      sortOrder: 3,
    },
    {
      code: 'CLINIC_ANNUAL',
      name: 'Clinic (Annual)',
      description: 'Multi-doctor clinic for up to 5 veterinarians. Save ₹2,989/year with annual billing.',
      interval: 'ANNUAL' as const,
      intervalCount: 1,
      pricePaisa: 1499900,
      currency: 'INR',
      trialPeriodDays: 0,
      maxUserSeats: 5,
      featuresJson: {
        maxVeterinarianSeats: 5,
        annualSavingsPaisa: 298900,
        savingsPercentage: 16.6,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
        multiUserCollaboration: true,
      },
      sortOrder: 4,
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Custom solutions for veterinary hospitals and multi-location networks.',
      interval: 'ANNUAL' as const,
      intervalCount: 1,
      pricePaisa: 0,
      currency: 'INR',
      trialPeriodDays: 0,
      maxUserSeats: 999,
      featuresJson: {
        maxVeterinarianSeats: 999,
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
        multiUserCollaboration: true,
      },
      sortOrder: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        intervalCount: plan.intervalCount,
        pricePaisa: plan.pricePaisa,
        currency: plan.currency,
        trialPeriodDays: plan.trialPeriodDays,
        maxUserSeats: plan.maxUserSeats,
        featuresJson: plan.featuresJson,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }

  const demoEmail = 'doctor@vetrx.local';
  const normalizedEmail = demoEmail.toLowerCase().trim();

  // Check if demo user already exists
  const existingUser = await prisma.user.findUnique({
    where: { normalizedEmail },
  });

  if (existingUser) {
    console.log(`Demo user (${demoEmail}) already exists. Skipping user creation.`);
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
