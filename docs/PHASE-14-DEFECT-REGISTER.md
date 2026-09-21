# VetRx — Phase 14 Defect Register
## User Management, RBAC & Practice Administration

## 1. Summary of Active Defects

| Severity | Definition | Active Count |
| :--- | :--- | :--- |
| **P0 — Critical Blocker** | Privilege escalation, cross-tenant leak, orphaned practice, data loss, security bypass | **0** |
| **P1 — High Severity** | User management, invitation acceptance, or authorization blocked with no workaround | **0** |
| **P2 — Medium Severity** | Non-blocking edge case, quota miscalculation, UI state sync latency | **0** |
| **P3 — Low Severity** | Minor UI label nuance or cosmetic styling difference | **0** |

**Total Open Defects: 0**

---

## 2. Tracked Items During Phase 14 Development

| Defect ID | Severity | Description | Status | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `DEF-14-01` | P0 | **Potential Orphaned Practice on Owner Deactivation**<br>If a practice owner could deactivate their own account or be deactivated by an admin, the practice would have no owner to manage billing or invite members. | RESOLVED | Added explicit guard in `MemberService.deactivateMember` preventing deactivation of the `PRACTICE_OWNER`. Tested in unit test 4.5. |
| `DEF-14-02` | P0 | **Privilege Escalation via Role Self-Assignment or Update**<br>Admins could potentially promote themselves or other members to `PRACTICE_OWNER` via `updateMemberRole`, circumventing ownership transfer rules. | RESOLVED | Blocked `Role.PRACTICE_OWNER` assignment via `updateMemberRole`. Enforced that `PRACTICE_OWNER` role changes must strictly execute through `transferOwnership`. |
| `DEF-14-03` | P0 | **Plaintext Token Storage in Database**<br>Storing invitation tokens in plaintext could allow database administrators or leaked backups to impersonate invited staff members. | RESOLVED | Enforced CSPRNG 32-byte token generation (`crypto.randomBytes(32).toString('hex')`) with only the SHA-256 hash stored in the database. The raw token is sent only in the invitation URL. |
| `DEF-14-04` | P1 | **Commercial Seat Quota Miscounting**<br>Individual plans cap veterinarian seats at 1. If the practice owner is also a veterinarian but wasn't counted, or if non-vets were counted against vet limits, quotas would be violated. | RESOLVED | Updated `EntitlementService.assertCanAddSeat` and `getPracticeUsage` so that both `PRACTICE_OWNER` and `VETERINARIAN` count toward the veterinarian seat quota, while `STAFF` and `READ_ONLY` seats remain unlimited. |
| `DEF-14-05` | P1 | **Deactivated Member Authorization Bypass**<br>Deactivated members retained their membership role in the database and might bypass permission checks if status was not verified. | RESOLVED | Enforced `isActive === true` validation in `AuthorizationService.hasPermission`, `requirePermission`, and `requirePracticePermission` middleware before evaluating role permissions. |
| `DEF-14-06` | P1 | **Replay Attacks on Invitation Tokens**<br>An accepted or revoked invitation token could theoretically be re-submitted to recreate a practice membership. | RESOLVED | Implemented strict state checking in `InvitationService.acceptInvitation` ensuring invitations can only be accepted when `status === PENDING` and `expiresAt > new Date()`, transitioning immediately to `ACCEPTED`. |
| `DEF-14-07` | P2 | **Platform Super Admin Role Leaking into Practice Memberships**<br>Attempting to assign platform administration through `PracticeMember` would conflate tenant boundaries and risk cross-tenant data access. | RESOLVED | Isolated `PLATFORM_SUPER_ADMIN` into `User.platformRole` field on `User`, completely separate from `PracticeMember.role`. Platform operations require `requirePlatformPermission`. |
