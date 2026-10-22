import { runRemoteStdin } from './vps_exec_stdin.mjs';

const script = `
set -e
mkdir -p /home/ncms/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/home/ncms/backups/vetrx_pre_importer_deploy_\${TIMESTAMP}.dump"
echo "Starting pg_dump to \${BACKUP_FILE}..."

docker exec vetrx-postgres-prod pg_dump -U vetrx -Fc vetrx > "\${BACKUP_FILE}"

if [ -s "\${BACKUP_FILE}" ]; then
  echo "BACKUP_STATUS=SUCCESS"
  echo "BACKUP_PATH=\${BACKUP_FILE}"
  echo "BACKUP_TIMESTAMP=\${TIMESTAMP}"
  ls -lh "\${BACKUP_FILE}"
  file "\${BACKUP_FILE}"
else
  echo "BACKUP_STATUS=FAILED"
  exit 1
fi
`;

console.log(runRemoteStdin(script));
