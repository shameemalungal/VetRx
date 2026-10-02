# VetRx Phase 14 — Practice Administration & Ownership Transfer

## 1. Practice Administration Domain
Practice administration empowers practice owners and administrators to govern clinic operations, formulary configurations, master data, staff permissions, and commercial subscriptions.

---

## 2. Practice Settings Governance
- **Permissions Required**: `PRACTICE_SETTINGS_MANAGE`.
- **Protected Resources**:
  - Clinic branding (name, logo, registration numbers).
  - Doctor qualifications and digital signatures.
  - Formularies and custom medicine additions (`MEDICINE_CREATE`).
  - Standard clinical packages (`PACKAGE_CREATE`).
- **Access Restrictions**:
  - Veterinarians, Staff, and Read-Only members cannot modify clinic identity or settings.

---

## 3. Atomic Ownership Transfer Flow

```
Current Practice Owner
         ↓
POST /api/practice/ownership/transfer
  { targetMemberId, previousOwnerRole: "PRACTICE_ADMIN" }
         ↓
Authoritative Verification:
  1. Actor must be verified current Practice Owner (isPracticeOwner).
  2. Actor has OWNERSHIP_TRANSFER permission.
  3. Target member exists, is active (MEMBER_INACTIVE blocked).
  4. Target is not self (SELF_TRANSFER_FORBIDDEN).
  5. previousOwnerRole cannot be PRACTICE_OWNER.
         ↓
Prisma Atomic Transaction:
  1. Practice.ownerUserId = targetMember.userId
  2. Target PracticeMember.role = PRACTICE_OWNER
  3. Previous Owner PracticeMember.role = previousOwnerRole
         ↓
Record AuditLog:
  action: "OWNERSHIP_TRANSFERRED"
  details: { previousOwnerUserId, newOwnerUserId, previousOwnerRole }
```

### Invariants:
1. **Single Owner Guarantee**: The practice model strictly enforces a single authoritative owner at any given moment.
2. **Immediate Role Transition**: The old owner immediately loses `PRACTICE_OWNER` privileges and transitions to the chosen permitted role (`PRACTICE_ADMIN` by default).
3. **Double Confirmation**: The frontend requires explicit keyword typing ("TRANSFER") before dispatching the transfer request.
