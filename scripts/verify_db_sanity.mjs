import { runRemote } from './vps_exec.mjs';

const sql = `
SELECT enum_range(NULL::"Role") AS roles;
SELECT enum_range(NULL::"PlatformRole") AS platform_roles;
SELECT enum_range(NULL::"InvitationStatus") AS invitation_statuses;
SELECT count(*) AS invitations_count FROM "PracticeInvitation";
SELECT count(*) AS payments_count FROM "Payment";
SELECT count(*) AS payment_events_count FROM "PaymentEvent";
`;

const res = runRemote(`docker exec -i vetrx-postgres-prod psql -U vetrx -d vetrx << 'EOF'
${sql}
EOF
`);

console.log(res);
