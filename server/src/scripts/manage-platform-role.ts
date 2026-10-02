import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface ScriptOptions {
  email?: string;
  confirm?: boolean;
}

export function parseArgs(args: string[]): ScriptOptions {
  let email: string | undefined;
  let confirm = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length).replace(/^["']|["']$/g, '').trim();
    } else if (arg === '--email' && i + 1 < args.length) {
      email = args[++i].replace(/^["']|["']$/g, '').trim();
    } else if (arg === '--yes' || arg === '-y' || arg === '--confirm') {
      confirm = true;
    }
  }

  return { email, confirm };
}

export async function executePlatformRoleChange(
  targetRole: PlatformRole | null,
  operationName: 'Bootstrap Super Admin' | 'Demote Super Admin',
  options: ScriptOptions,
  db: any = prisma,
  exitFn: (code: number) => void = (code) => process.exit(code)
): Promise<{ success: boolean; user?: any; reason?: string }> {
  const { email, confirm } = options;

  if (!email || email.trim().length === 0) {
    console.error(`\nError: Missing required argument --email\n`);
    console.error(`Usage:`);
    if (targetRole === PlatformRole.PLATFORM_SUPER_ADMIN) {
      console.error(`  npm run admin:promote-super-admin -- --email="user@example.com"\n`);
    } else {
      console.error(`  npm run admin:demote-super-admin -- --email="user@example.com"\n`);
    }
    exitFn(1);
    return { success: false, reason: 'MISSING_EMAIL' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Safety: Look up by normalizedEmail and email
  const users = await db.user.findMany({
    where: {
      OR: [
        { normalizedEmail },
        { email: normalizedEmail },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      normalizedEmail: true,
      platformRole: true,
      isActive: true,
    },
  });

  if (users.length === 0) {
    console.error(`\nError: No user found matching email "${email}".`);
    console.error(`Please verify that the user account already exists in VetRx.\n`);
    exitFn(1);
    return { success: false, reason: 'USER_NOT_FOUND' };
  }

  if (users.length > 1) {
    console.error(`\nError: Multiple users (${users.length}) found matching "${email}".`);
    console.error(`Refusing to proceed to prevent unintended role modification.\n`);
    exitFn(1);
    return { success: false, reason: 'MULTIPLE_USERS' };
  }

  const user = users[0];
  const currentRoleDisplay = user.platformRole ?? 'NONE';
  const targetRoleDisplay = targetRole ?? 'NONE';

  if (user.platformRole === targetRole) {
    console.log(`\nNotice: User "${user.email}" already has platformRole = ${targetRoleDisplay}.`);
    console.log(`No database changes are needed.\n`);
    if (db.$disconnect) await db.$disconnect();
    return { success: true, user, reason: 'ALREADY_ASSIGNED' };
  }

  console.log(`\n============================================================`);
  console.log(`VetRx Platform Super Admin ${operationName === 'Bootstrap Super Admin' ? 'Bootstrap' : 'Rollback'}`);
  console.log(`============================================================\n`);
  console.log(`User:`);
  console.log(`Name:    ${user.name}`);
  console.log(`Email:   ${user.email}`);
  console.log(`User ID: ${user.id}\n`);
  console.log(`Current platform role:`);
  console.log(`${currentRoleDisplay}\n`);
  console.log(`New platform role:`);
  console.log(`${targetRoleDisplay}\n`);
  console.log(`This action changes ONLY User.platformRole.`);
  console.log(`============================================================\n`);

  if (!confirm) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question('Continue? [yes/no]: ');
    rl.close();

    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('\nOperation aborted. No changes were made.\n');
      if (db.$disconnect) await db.$disconnect();
      exitFn(0);
      return { success: false, reason: 'ABORTED' };
    }
  }

  const previousRole = user.platformRole;

  // Atomic interactive transaction:
  // If AuditLog creation fails, the platformRole update is rolled back automatically.
  try {
    await db.$transaction(async (tx: any) => {
      // 1. Update ONLY platformRole
      await tx.user.update({
        where: { id: user.id },
        data: {
          platformRole: targetRole,
        },
      });

      // 2. Create AuditLog entry within the exact same transaction
      await tx.auditLog.create({
        data: {
          practiceId: null,
          userId: user.id,
          action:
            targetRole === PlatformRole.PLATFORM_SUPER_ADMIN
              ? 'PLATFORM_ROLE_PROMOTION'
              : 'PLATFORM_ROLE_REVOCATION',
          resource: 'User',
          resourceId: user.id,
          details: {
            targetEmail: user.email,
            previousPlatformRole: previousRole,
            newPlatformRole: targetRole,
            mechanism: 'ADMIN_BOOTSTRAP_CLI',
            timestamp: new Date().toISOString(),
          },
          ipAddress: '127.0.0.1',
          userAgent: 'VetRx-Admin-Bootstrap-CLI',
        },
      });
    });
  } catch (txErr) {
    console.error(`\nFAILURE: Database transaction failed. All changes were rolled back.`);
    console.error(`Error details: ${String(txErr)}\n`);
    if (db.$disconnect) await db.$disconnect();
    exitFn(1);
    return { success: false, reason: 'TRANSACTION_FAILED' };
  }

  // Re-fetch user from database to confirm update
  const updatedUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
    },
  });

  if (!updatedUser || updatedUser.platformRole !== targetRole) {
    console.error(`\nFAILURE: Database verification failed. platformRole was not updated.`);
    if (db.$disconnect) await db.$disconnect();
    exitFn(1);
    return { success: false, reason: 'VERIFICATION_FAILED' };
  }

  console.log(`\n============================================================`);
  console.log(`SUCCESS\n`);
  if (targetRole === PlatformRole.PLATFORM_SUPER_ADMIN) {
    console.log(`User is now PLATFORM_SUPER_ADMIN.\n`);
  } else {
    console.log(`User platform role has been revoked (now ${targetRoleDisplay}).\n`);
  }
  console.log(`Details:`);
  console.log(`  User ID:               ${updatedUser.id}`);
  console.log(`  Email:                 ${updatedUser.email}`);
  console.log(`  Previous platformRole: ${currentRoleDisplay}`);
  console.log(`  New platformRole:      ${updatedUser.platformRole ?? 'NONE'}`);
  console.log(`============================================================\n`);

  if (db.$disconnect) await db.$disconnect();
  return { success: true, user: updatedUser };
}
