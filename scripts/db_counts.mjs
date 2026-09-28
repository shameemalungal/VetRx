import { runRemote } from './vps_exec.mjs';

const sql = `SELECT 
  (SELECT count(*) FROM "User") as users, 
  (SELECT count(*) FROM "Practice") as practices, 
  (SELECT count(*) FROM "PracticeMember") as members, 
  (SELECT count(*) FROM "Patient") as patients, 
  (SELECT count(*) FROM "Prescription") as prescriptions, 
  (SELECT count(*) FROM "Subscription") as subscriptions, 
  (SELECT count(*) FROM "Payment") as payments, 
  (SELECT count(*) FROM "AuditLog") as audit_logs;`;

const auditSql = `SELECT * FROM \\"AuditLog\\" WHERE id = '341273f4-2bbd-4a58-b1b9-2e3b38044ef5';`;

console.log('=== TABLE COUNTS ===');
console.log(runRemote(`docker exec vetrx-postgres-prod psql -U vetrx -d vetrx -x -c '${sql}'`));

console.log('=== PROMOTION AUDIT RECORD ===');
console.log(runRemote(`docker exec vetrx-postgres-prod psql -U vetrx -d vetrx -x -c "SELECT * FROM \\\"AuditLog\\\" WHERE id = '341273f4-2bbd-4a58-b1b9-2e3b38044ef5';" || true`));
