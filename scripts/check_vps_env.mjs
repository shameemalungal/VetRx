import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const askpassPath = path.resolve('askpass.bat');
fs.writeFileSync(askpassPath, '@echo Fiza469@\r\n');

try {
  const env = {
    ...process.env,
    SSH_ASKPASS: askpassPath,
    SSH_ASKPASS_REQUIRE: 'force',
    DISPLAY: 'dummy:0',
  };

  const script = `
python3 - << 'EOF'
import os
path = '/home/ncms/VetRx/.env'
if not os.path.exists(path):
    print('FILE_NOT_FOUND')
else:
    with open(path) as f:
        lines = f.readlines()
    for v in ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'GOOGLE_REDIRECT_URI']:
        matching = [l.strip() for l in lines if l.startswith(v + '=')]
        if not matching:
            print(f'{v}: NOT SET')
        else:
            val = matching[0].split('=', 1)[1].strip()
            if not val:
                print(f'{v}: EMPTY')
            else:
                print(f'{v}: SET (len: {len(val)})')
EOF
`;

  const b64 = Buffer.from(script).toString('base64');
  const out = execSync(
    `ssh -i "C:\\Users\\drsha\\.ssh\\ncms_production" -o StrictHostKeyChecking=no ncms@109.122.56.148 "echo '${b64}' | base64 -d | bash"`,
    { env, encoding: 'utf8' }
  );
  console.log(out);
} finally {
  if (fs.existsSync(askpassPath)) {
    fs.unlinkSync(askpassPath);
  }
}
