# VetRx Phase 14 — RBAC Architecture

## 1. Architectural Overview
VetRx implements a multi-tenant authorization layer where identity, tenancy, roles, and commercial capabilities are separated into strict orthogonal tiers:

```
Authentication (Who you are: User)
    ↓
Practice Membership (Where you belong: PracticeMember)
    ↓
Role (Designation: Owner, Admin, Veterinarian, Staff, Read Only)
    ↓
Permissions (What actions you can perform: Granular permission strings)
    ↓
Commercial Entitlements (What the practice plan permits: EntitlementService)
    ↓
Authorized Action
```

In parallel, a strictly isolated **Platform Authorization Domain** exists outside practice membership for internal VetRx administrative oversight.

---

## 2. Authorization Tiers

### A. Practice-Level Authorization
Practice-level authorization governs access to resources within a single practice tenant boundary.
- **Tenant Scope**: Derived authoritatively from the server session's active `PracticeMember` record (`req.practice` and `req.membership`). Client-supplied `practiceId` headers or request bodies are never trusted for authorization.
- **Canonical Practice Roles**:
  1. `PRACTICE_OWNER`: Full administrative, clinical, and commercial authority; only role permitted to transfer practice ownership.
  2. `PRACTICE_ADMIN`: Operational and staff administration, clinical workflows, and read-only billing oversight. Cannot transfer ownership, promote to Owner, or modify the Owner.
  3. `VETERINARIAN`: Clinical practitioner with full prescription and medical history capabilities. Lacks user management, practice settings mutation, billing management, and ownership transfer.
  4. `STAFF`: Operational support (patient registration, owner records, clinical record viewing, operational invoices). Explicitly lacks prescription issuance, user management, and billing management.
  5. `READ_ONLY`: View-only observer role across patients, prescriptions, medicines, and invoices. Zero mutation capabilities.
  6. `PRACTICE_STAFF`: Legacy backward-compatible alias that resolves identically to `STAFF`.

### B. Platform Authorization
Platform administration operates independently from `PracticeMember`:
- **Model Storage**: `User.platformRole` (`enum PlatformRole { PLATFORM_SUPER_ADMIN }`).
- **Isolation Principle**: Platform roles are never stored in or mapped to `PracticeMember`. Normal practice members can never access `/api/platform/admin/...` endpoints regardless of their role within an individual practice.
- **Scope**: Platform-wide practice health inspection, tenant subscription monitoring, and security audit log review.

---

## 3. Permission Resolution Flow
1. **Request Reception**: Express receives HTTP request with HttpOnly session cookie.
2. **Session Authentication (`requireAuth`)**: Hashes session token with SHA-256, verifies validity in database, and injects `req.user`.
3. **Tenant Context Resolution (`requirePractice`)**: Queries active `PracticeMember` record where `userId = req.user.id` and `isActive = true`. Injects `req.practice` and `req.membership`.
4. **Authorization Middleware (`requirePracticePermission`)**:
   - Calls `AuthorizationService.requirePermission(userId, practiceId, permission)`.
   - Resolves effective permissions from `ROLE_PERMISSIONS[role]`.
   - Confirms `membership.isActive === true`.
   - Injects `req.permissions` into the request context.
5. **Commercial Entitlement Check (where applicable)**:
   - Evaluates commercial seat quotas (e.g. `EntitlementService.assertCanAddSeat`).
6. **Controller Execution**: Service logic executes strictly within the tenant boundary.

---

## 4. Multi-Practice Isolation Invariant
A single `User` can be a member of multiple practices (e.g. Veterinarian in Practice Alpha, Practice Admin in Practice Beta).
- Permissions are strictly evaluated against the **active practice context**.
- Role privileges in Practice Alpha never leak into Practice Beta.
- Attempting to access Practice Beta resources with an active Practice Alpha context results in `403 NOT_PRACTICE_MEMBER` or `404 NOT_FOUND`.
