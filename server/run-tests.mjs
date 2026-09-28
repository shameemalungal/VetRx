import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const testDir = 'tests';
const files = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(testDir, f));

let failed = false;
for (const file of files) {
  const res = spawnSync(
    process.execPath,
    ['--max-old-space-size=4096', '--import', 'tsx/esm', '--test', file],
    { stdio: 'inherit' }
  );
  if (res.status !== 0) {
    failed = true;
    break;
  }
}

process.exit(failed ? 1 : 0);
