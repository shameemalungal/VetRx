import { runRemote } from './vps_exec.mjs';

const sql = `
SELECT u.id, u.email, u.name, u."platformRole", m.id as member_id, m.role, m."isActive", m."practiceId"
FROM "User" u
LEFT JOIN "PracticeMember" m ON u.id = m."userId";

SELECT * FROM "MemberPermissionOverride";

SELECT id, "rxNumber", status, "forwardedToUserId", "approvedByUserId", "createdAt" 
FROM "Prescription" 
ORDER BY "createdAt" DESC 
LIMIT 5;
`;

const res = runRemote(`docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx << 'EOF'
${sql}
EOF
`);

console.log(res);
