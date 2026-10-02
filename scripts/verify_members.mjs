import { runRemote } from './vps_exec.mjs';

const sql = `
SELECT u.id, u.email, u.name, pm.role, pm."isActive"
FROM "User" u
JOIN "PracticeMember" pm ON pm."userId" = u.id
LIMIT 5;
`;

const res = runRemote(`docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx << 'EOF'
${sql}
EOF
`);

console.log(res);
