import { runRemote } from './vps_exec.mjs';

const cmd = 'mkdir -p /home/ncms/backups && docker exec -i vetrx-postgres-prod pg_dump -U vetrx vetrx > /home/ncms/backups/vetrx_prod_backup_$(date +%Y%m%d_%H%M%S).sql && ls -lh /home/ncms/backups';
console.log('Running backup on VPS...');
const out = runRemote(cmd);
console.log(out);
