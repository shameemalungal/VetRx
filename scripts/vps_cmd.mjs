import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const remoteCmd = process.argv[2];
if (!remoteCmd) {
  console.error('Usage: node scripts/vps_cmd.mjs "<command>"');
  process.exit(1);
}

const askpassPath = path.resolve('askpass.bat');
fs.writeFileSync(askpassPath, '@echo Fiza469@\r\n');

try {
  const env = {
    ...process.env,
    SSH_ASKPASS: askpassPath,
    SSH_ASKPASS_REQUIRE: 'force',
    DISPLAY: 'dummy:0',
  };

  console.log(`Executing on VPS: ${remoteCmd}`);
  const out = execSync(
    `ssh -i "C:\\Users\\drsha\\.ssh\\ncms_production" -o StrictHostKeyChecking=no ncms@109.122.56.148 "${remoteCmd}"`,
    { env, stdio: 'inherit' }
  );
} finally {
  if (fs.existsSync(askpassPath)) {
    fs.unlinkSync(askpassPath);
  }
}
