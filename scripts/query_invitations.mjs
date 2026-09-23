import { runRemote } from './vps_exec.mjs';

const sql = `
SELECT id, "practiceId", email, role, status, "expiresAt", "createdAt", length("tokenHash") as hash_len
FROM "PracticeInvitation"
ORDER BY "createdAt" DESC
LIMIT 5;
`;

const res = runRemote(`docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx << 'EOF'
${sql}
EOF
`);

console.log(res);
