import { parseArgs, executePlatformRoleChange } from './manage-platform-role.js';

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await executePlatformRoleChange(
    null,
    'Demote Super Admin',
    options
  );
}

main().catch((err) => {
  console.error('\nFatal error during demotion execution:', err);
  process.exit(1);
});
