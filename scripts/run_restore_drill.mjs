import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const askpassPath = path.resolve('askpass.bat');
fs.writeFileSync(askpassPath, '@echo Fiza469@\r\n');

function runRemote(bashScript) {
  const b64 = Buffer.from(bashScript).toString('base64');
  const env = {
    ...process.env,
    SSH_ASKPASS: askpassPath,
    SSH_ASKPASS_REQUIRE: 'force',
    DISPLAY: 'dummy:0',
  };
  return execSync(
    `ssh -i "C:\\Users\\drsha\\.ssh\\ncms_production" -o StrictHostKeyChecking=no ncms@109.122.56.148 "echo '${b64}' | base64 -d | bash"`,
    { env, encoding: 'utf8' }
  );
}

try {
  const script = `
set -e
echo "=== 1. VERIFYING RESTORED TABLES IN VETRX-RESTORE-DRILL ==="
docker exec vetrx-restore-drill psql -U vetrx -d vetrx -c "
SELECT
  (SELECT count(*) FROM \\"Practice\\") AS practices,
  (SELECT count(*) FROM \\"User\\") AS users,
  (SELECT count(*) FROM \\"PracticeMember\\") AS members,
  (SELECT count(*) FROM \\"Owner\\") AS owners,
  (SELECT count(*) FROM \\"Patient\\") AS patients,
  (SELECT count(*) FROM \\"Prescription\\") AS prescriptions,
  (SELECT count(*) FROM \\"PrescriptionItem\\") AS rx_items,
  (SELECT count(*) FROM \\"TreatmentPackage\\") AS packages,
  (SELECT count(*) FROM \\"Medicine\\") AS medicines,
  (SELECT count(*) FROM \\"Invoice\\") AS invoices,
  (SELECT count(*) FROM \\"InvoiceItem\\") AS invoice_items,
  (SELECT count(*) FROM \\"AuditLog\\") AS audit_logs;
"

echo "=== 2. RELATIONAL INTEGRITY VERIFICATION ==="
docker exec vetrx-restore-drill psql -U vetrx -d vetrx -c "
-- Orphan checks (Foreign Key Integrity)
SELECT 'Orphan Patients' as check, count(*) from \\"Patient\\" p LEFT JOIN \\"Owner\\" o ON p.\\"ownerId\\" = o.id WHERE o.id IS NULL;
SELECT 'Orphan Prescriptions' as check, count(*) from \\"Prescription\\" r LEFT JOIN \\"Patient\\" p ON r.\\"patientId\\" = p.id WHERE p.id IS NULL;
SELECT 'Orphan Practice Members' as check, count(*) from \\"PracticeMember\\" pm LEFT JOIN \\"Practice\\" pr ON pm.\\"practiceId\\" = pr.id WHERE pr.id IS NULL;
"

echo "=== 3. REPRESENTATIVE SAMPLE DATA VERIFICATION ==="
docker exec vetrx-restore-drill psql -U vetrx -d vetrx -c "
SELECT id, name, slug, \\"createdAt\\" FROM \\"Practice\\" LIMIT 2;
"

echo "=== 4. PRISMA CLIENT CONNECTION VERIFICATION ==="
docker network connect vetrx_vetrx_prod_network vetrx-restore-drill || true
docker compose -f /home/ncms/VetRx/docker-compose.prod.yml exec -T -e DATABASE_URL="postgresql://vetrx:drill_pass@vetrx-restore-drill:5432/vetrx?schema=public" backend node -e "
import('@prisma/client').then(({ PrismaClient }) => {
  const p = new PrismaClient({ datasources: { db: { url: 'postgresql://vetrx:drill_pass@vetrx-restore-drill:5432/vetrx?schema=public' } } });
  return p.practice.count().then(count => {
    console.log('SUCCESS: Prisma connected to restored database! Practice count:', count);
    return p.\\$disconnect();
  });
}).catch(err => {
  console.error('Prisma connection error:', err);
  process.exit(1);
});
"

echo "=== 5. CLEANUP ISOLATED RESTORE CONTAINER ==="
docker rm -f vetrx-restore-drill
echo "CLEANUP COMPLETE: vetrx-restore-drill container removed."
`;

  const output = runRemote(script);
  console.log(output);
} finally {
  if (fs.existsSync(askpassPath)) {
    fs.unlinkSync(askpassPath);
  }
}
