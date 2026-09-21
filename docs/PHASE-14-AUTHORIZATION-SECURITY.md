# VetRx Phase 14 — Authorization Security Controls

## 1. Threat Matrix & Defensive Countermeasures

| Security Threat | Attack Vector | Countermeasure Implemented |
|---|---|---|
| **1. Privilege Escalation** | User modifies own role via API | Server blocks self-role modification (`SELF_ROLE_CHANGE_FORBIDDEN`). Role changes require `ROLE_ASSIGN` and cannot promote to Owner. |
| **2. Unauthorized Ownership Takeover** | Admin attempts to transfer ownership | `OWNERSHIP_TRANSFER` is restricted strictly to `PRACTICE_OWNER`. `isPracticeOwner()` checks authoritative `Practice.ownerUserId`. |
| **3. Client-Side Parameter Tampering** | Client submits modified `practiceId` or `role` in payload | Backend derives tenant context and permissions entirely from server-side session and database membership (`requirePractice`). Client values are ignored. |
| **4. Orphaned Practice Account** | Admin deactivates last owner | Deactivating the `PRACTICE_OWNER` is rejected with `CANNOT_REMOVE_LAST_OWNER`. Ownership must be transferred first. |
| **5. Cross-Tenant Data Access** | User in Practice A accesses Practice B records | Requests must pass `requirePractice` matching active membership. Cross-tenant access returns `403 NOT_PRACTICE_MEMBER`. |
| **6. Token Hijacking & Replay** | Attacker intercepts or reuses invitation token | Tokens are cryptographically random (32-bytes CSPRNG), stored hashed with SHA-256, strictly one-time use (`INVITATION_ALREADY_ACCEPTED`), expire in 7 days, and require verified email match. |
| **7. Commercial Quota Bypass** | User invites extra veterinarians beyond plan cap | `EntitlementService.assertCanAddSeat` validates veterinarian seat caps at both invitation creation and acceptance time (`SEAT_LIMIT_REACHED`). |
| **8. Unauthorized Billing Access** | Staff or Veterinarian attempts to cancel or buy subscriptions | Commercial write routes require `SUBSCRIPTION_MANAGE` or `BILLING_MANAGE`. Only `PRACTICE_OWNER` holds these permissions. |
| **9. Platform Admin Impersonation** | Member claims Super Admin status | `User.platformRole` is verified on the server database. Platform routes are isolated under `/api/platform/admin/...` with `requirePlatformPermission`. |
| **10. Deactivated User Session Persistence** | Deactivated user attempts API requests | `requirePractice` and `AuthorizationService.resolveMembership` verify `membership.isActive === true` on every request. Deactivated members receive `403 MEMBERSHIP_DISABLED`. |

---

## 2. Invariant Checklist
- [x] Zero trust of client-submitted roles, permissions, or practice IDs.
- [x] All clinical and administrative write operations create immutable `AuditLog` records.
- [x] PayU merchant secrets (`PAYU_MERCHANT_SALT`) are never exposed to clients or logged.
- [x] Deactivation never cascade-deletes medical history or prescription records.
- [x] Phase 5 frozen prescription and invoice PDFs remain strictly untouched.
