import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const fileToRun = process.argv[2];
if (!fileToRun || !fs.existsSync(fileToRun)) {
  console.error('Usage: node scripts/run_node_vps.mjs <local_file.mjs>');
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

  const fileContent = fs.readFileSync(fileToRun, 'utf-8');
  console.log(`Executing ${fileToRun} in vetrx-backend-prod on VPS...`);
  
  execSync(
    `ssh -i "C:\\Users\\drsha\\.ssh\\ncms_production" -o StrictHostKeyChecking=no ncms@109.122.56.148 "docker exec -i vetrx-backend-prod node -"`,
    {
      input: fileContent,
      env,
      stdio: ['pipe', 'inherit', 'inherit'],
    }
  );
} finally {
  if (fs.existsSync(askpassPath)) {
    fs.unlinkSync(askpassPath);
  }
}
