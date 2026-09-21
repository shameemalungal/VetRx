# VetRx Phase 14 — User Management & Member Lifecycle

## 1. Principles of Practice Membership
- **Tenant Scope**: A user accesses a practice only through an active `PracticeMember` relation (`practiceId`, `userId`, `role`, `isActive`).
- **Initial Registration Rule**: The first user who registers a practice (via email/password or Google) automatically becomes `PRACTICE_OWNER`.
- **Invitation Flow**: Subsequent members join only through explicit invitations created by authorized administrators (`PRACTICE_OWNER` or `PRACTICE_ADMIN`).

---

## 2. Member Lifecycle States

```
[ Invitation Sent ] ──► [ Accepted ] ──► [ Active Member ]
         │                                    │
         ▼                                    ▼
[ Revoked / Expired ]                 [ Deactivated Member ]
                                              │
                                              ▼
                                      [ Reactivated Member ]
```

### A. Member Listing (`GET /api/practice/members`)
- Requires `USER_VIEW` permission.
- Returns list of members with safe user details (`id`, `name`, `email`, `avatarUrl`), active role, status (`isActive`), and join date.

### B. Safe Role Assignment (`PATCH /api/practice/members/:id`)
- Requires `ROLE_ASSIGN` permission.
- **Rule 1 (No Self-Escalation)**: Users cannot change their own role (`SELF_ROLE_CHANGE_FORBIDDEN`).
- **Rule 2 (No Direct Owner Assignment)**: Promotion to `PRACTICE_OWNER` directly is rejected (`OWNER_TRANSFER_REQUIRED`).
- **Rule 3 (Admin Scope Limitation)**: Practice Admins cannot assign `PRACTICE_ADMIN` or modify other Admins (`ROLE_ASSIGNMENT_FORBIDDEN`).
- **Rule 4 (Seat Limit Enforcement)**: Upgrading a member's role to `VETERINARIAN` verifies that the practice has an available veterinarian seat.

### C. Deactivation vs. Deletion (`POST /api/practice/members/:id/deactivate`)
- Requires `USER_DEACTIVATE` permission.
- **Record Preservation**: Deactivation sets `isActive: false` on `PracticeMember`. It **never** cascades to delete historical clinical records, prescriptions, invoices, or audit logs.
- **Last Owner Protection**: The `PRACTICE_OWNER` cannot be deactivated (`CANNOT_REMOVE_LAST_OWNER`).
- **Self-Deactivation Protection**: An administrator cannot deactivate their own membership (`SELF_DEACTIVATION_FORBIDDEN`).
- **Session Revocation**: Stale permissions are invalidated immediately on subsequent requests.

### D. Reactivation (`POST /api/practice/members/:id/reactivate`)
- Requires `USER_REACTIVATE` permission.
- If reactivating a member with role `VETERINARIAN`, commercial seat quotas are re-checked against active plan limits before re-enabling access.
