import { PlatformRole } from '@prisma/client';
import { parseArgs, executePlatformRoleChange } from './manage-platform-role.js';

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await executePlatformRoleChange(
    PlatformRole.PLATFORM_SUPER_ADMIN,
    'Bootstrap Super Admin',
    options
  );
}

main().catch((err) => {
  console.error('\nFatal error during promotion execution:', err);
  process.exit(1);
});
