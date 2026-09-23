import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function runRemote(cmd) {
  const askpassPath = path.resolve('askpass.bat');
  fs.writeFileSync(askpassPath, '@echo Fiza469@\r\n');
  try {
    const env = {
      ...process.env,
      SSH_ASKPASS: askpassPath,
      SSH_ASKPASS_REQUIRE: 'force',
      DISPLAY: 'dummy:0',
    };
    const b64 = Buffer.from(cmd).toString('base64');
    const out = execSync(
      `ssh -i "C:\\Users\\drsha\\.ssh\\ncms_production" -o StrictHostKeyChecking=no ncms@109.122.56.148 "echo '${b64}' | base64 -d | bash -l"`,
      { env, encoding: 'utf8' }
    );
    return out;
  } finally {
    if (fs.existsSync(askpassPath)) {
      fs.unlinkSync(askpassPath);
    }
  }
}

const cmd = process.argv.slice(2).join(' ');
if (cmd) {
  try {
    const res = runRemote(cmd);
    console.log(res);
  } catch (err) {
    console.error(err.stdout || err.message);
    process.exit(1);
  }
}
