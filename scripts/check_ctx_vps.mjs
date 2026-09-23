import { runRemote } from './vps_exec.mjs';

const script = `
docker exec -i vetrx-backend-prod node -e "
import('./dist/auth/auth.service.js').then(async ({ AuthService }) => {
  const ctx = await AuthService.getMeContext('7564adb4-0916-4cdd-80ff-28875ea77ae9', 'f199a58c-c794-491b-89e1-e71453de389b');
  console.log('USER:', ctx.user.email);
  console.log('ROLE:', ctx.membership.role);
  console.log('PERMISSIONS:', ctx.permissions);
  console.log('HAS PRESCRIPTION_APPROVE:', ctx.permissions.includes('PRESCRIPTION_APPROVE'));
}).catch(console.error);
"
`;

const res = runRemote(script);
console.log(res);
