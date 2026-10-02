import { runRemote } from './vps_exec.mjs';

const sql = `
SELECT 
  u.id as user_id, 
  u.email, 
  u.name, 
  u."platformRole", 
  m.id as membership_id, 
  m.role, 
  m."isActive", 
  m."practiceId",
  p.name as practice_name,
  p."ownerUserId"
FROM "User" u
JOIN "PracticeMember" m ON u.id = m."userId"
JOIN "Practice" p ON m."practiceId" = p.id
WHERE u.email IN ('shameem.sgs2@gmail.com', 'uat.staff@vetrx.test');
`;

const res = runRemote(`docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx << 'EOF'
${sql}
EOF
`);

console.log(res);
