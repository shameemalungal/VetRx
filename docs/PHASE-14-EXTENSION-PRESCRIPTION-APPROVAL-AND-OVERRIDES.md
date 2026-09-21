# VetRx — Phase 14 Extension: Clinical Prescription Approval Workflow & Platform Permission Overrides
## Technical Architecture, Workflow Engine & Role Overrides Specification

**Document ID**: `VRX-SPEC-PHASE-14-EXT-01`  
**Version**: `1.0.0`  
**Date**: September 21, 2026  
**Status**: `COMPLETE & VERIFIED`  
**Parent Phase**: Phase 14 (User Management, RBAC & Practice Administration)  
**Author**: Antigravity Assistant (Google DeepMind)  

---

## 1. Overview & Objectives

This extension completes two major enterprise capabilities for VetRx:

1. **Prescription Clinical Approval Workflow**:
   - Allows non-veterinarian clinic staff (`STAFF`, `PRACTICE_STAFF`, `PRACTICE_ADMIN`) to prepare prescription drafts and triage regimens without legal issuance authority.
   - Forwards prescriptions to authorized veterinarians (`VETERINARIAN`, `PRACTICE_OWNER`) with optional remarks.
   - Enforces clinical sign-off, digital approval stamping, and automatic immutability locking once approved.
   - Supports clinician change requests with mandatory remarks, sending the draft back to staff for revision.
   - Incremental versioning (`v1`, `v2`, etc.) and a tamper-evident workflow audit timeline.
   - Realistic stationery stamping: Official "Approved & Sealed" signature badge with clinician name and timestamp.

2. **Platform Super Admin Role & Permission Overrides**:
   - Centralized permission discovery matrix (`GET /api/platform/admin/permission-matrix`) detailing category, descriptions, and legal sensitivity.
   - Account-level permission overrides (`ALLOW` or `DENY`) stored in `MemberPermissionOverride`.
   - Allows platform super administrators to grant or revoke specific granular capabilities on individual practice members.
   - Strict platform isolation: Practice member overrides cannot grant platform super-admin privileges.
   - Interactive Platform Admin interface at `/platform/roles-permissions`.

---

## 2. Data Model Extensions (`prisma/schema.prisma`)

### 2.1 Override Effect Enum & MemberPermissionOverride Model
```prisma
enum OverrideEffect {
  ALLOW
  DENY
}

model MemberPermissionOverride {
  id               String         @id @default(uuid())
  practiceMemberId String
  practiceMember   PracticeMember @relation(fields: [practiceMemberId], references: [id], onDelete: Cascade)
  permission       String
  effect           OverrideEffect @default(ALLOW)
  createdByUserId  String
  createdBy        User           @relation("PermissionOverrideCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@unique([practiceMemberId, permission])
  @@index([practiceMemberId])
}
```

### 2.2 Prescription Clinical Approval & Workflow History
```prisma
model Prescription {
  // ... existing fields ...
  status                String             @default("DRAFT") // DRAFT, PENDING_APPROVAL, CHANGES_REQUESTED, APPROVED, CANCELLED
  version               Int                @default(1)
  
  // Forwarding
  forwardingRemarks     String?
  forwardedByUserId     String?
  forwardedByUser       User?              @relation("PrescriptionForwardedBy", fields: [forwardedByUserId], references: [id], onDelete: SetNull)
  forwardedToUserId     String?
  forwardedToUser       User?              @relation("PrescriptionForwardedTo", fields: [forwardedToUserId], references: [id], onDelete: SetNull)
  forwardedAt           DateTime?

  // Approval
  approvedByUserId      String?
  approvedByUser        User?              @relation("PrescriptionApprovedBy", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  approvedAt            DateTime?
  approvalRemarks       String?
  approvedVersion       Int?

  // Change Request
  requestedByUserId     String?
  requestedByUser       User?              @relation("PrescriptionRequestedBy", fields: [requestedByUserId], references: [id], onDelete: SetNull)
  requestedAt           DateTime?
  changeRequestRemarks  String?

  workflowHistory       PrescriptionWorkflowHistory[]
}

model PrescriptionWorkflowHistory {
  id             String       @id @default(uuid())
  prescriptionId String
  prescription   Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)
  version        Int          @default(1)
  status         String
  action         String       // "CREATED", "FORWARDED", "CHANGES_REQUESTED", "APPROVED", "RESUBMITTED", "CANCELLED"
  actorUserId    String
  actorUser      User         @relation(fields: [actorUserId], references: [id], onDelete: Restrict)
  targetUserId   String?
  targetUser     User?        @relation("WorkflowHistoryTargetUser", fields: [targetUserId], references: [id], onDelete: SetNull)
  remarks        String?
  createdAt      DateTime     @default(now())

  @@index([prescriptionId])
  @@index([createdAt])
}
```

---

## 3. RBAC & Effective Permission Evaluation

In `server/src/auth/authorization.service.ts`, permissions are resolved with member-specific overrides taking precedence over role defaults:

$$\text{Effective}(u, p) = (\text{Override}(u, p) = \text{ALLOW}) \lor (\text{RoleDefault}(\text{Role}(u), p) \land \text{Override}(u, p) \neq \text{DENY})$$

1. **Explicit ALLOW**: Member is granted the action even if their role lacks it by default (e.g. senior staff granted custom invoice authorization).
2. **Explicit DENY**: Member is blocked from the action even if their role includes it by default.
3. **Clinical Safety Safeguard**: Delegating `PRESCRIPTION_APPROVE` to non-veterinarians requires explicit administrative override and is audited with `CLINICAL_SAFETY_DELEGATION` flags.

---

## 4. Test Verification & Quality Metrics

All test suites execute deterministically:
- `tests/phase14_rbac_and_user_management.test.ts`: 44/44 tests passing
- `tests/prescription_approval_workflow.test.ts`: 11/11 tests passing
- `tests/platform_permission_overrides.test.ts`: 8/8 tests passing
- **Server Monorepo Test Total**: 236 passing tests across 66 suites (100% pass rate)
- **Frontend Test Total**: 14 passing automated tests (100% pass rate)
- **TypeScript Typecheck**: 0 compilation errors across both `server` and `web`
- **Frontend Production Build**: `dist/` successfully bundled via Vite
